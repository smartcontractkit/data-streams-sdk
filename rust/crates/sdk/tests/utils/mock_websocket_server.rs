use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::{mpsc, oneshot, Mutex, Notify},
};
use tokio_tungstenite::{
    accept_hdr_async,
    tungstenite::{handshake::server::Request as WsRequest, protocol::Message},
};

enum ServerCommand {
    Send(Vec<u8>),
    DropConnections,
    CloseConnections,
}

#[derive(Clone)]
pub struct MockWebSocketServer {
    address: String,
    command_sender: mpsc::Sender<ServerCommand>,
    shutdown_notify: Arc<Notify>,
    /// Origins returned in X-Cll-Available-Origins HEAD response.
    /// When None, defaults to two copies of the server's own ws:// address.
    ha_origins: Arc<Mutex<Option<Vec<String>>>>,
    /// X-Cll-Origin header values captured from incoming WebSocket upgrade requests.
    /// Some(value) if the header was present, None if absent.
    received_cll_origins: Arc<Mutex<Vec<Option<String>>>>,
}

impl MockWebSocketServer {
    pub async fn new(addr: &str) -> Self {
        let listener = TcpListener::bind(addr)
            .await
            .expect("Failed to bind address");

        let address = listener.local_addr().unwrap().to_string();
        println!("Mock WebSocket server started at: {}", address);

        let (command_sender, mut command_receiver) = mpsc::channel::<ServerCommand>(100);
        let clients = Arc::new(Mutex::new(Vec::new()));
        let shutdown_notify = Arc::new(Notify::new());
        let ha_origins: Arc<Mutex<Option<Vec<String>>>> = Arc::new(Mutex::new(None));
        let received_cll_origins: Arc<Mutex<Vec<Option<String>>>> =
            Arc::new(Mutex::new(Vec::new()));

        let clients_accept = clients.clone();
        let shutdown_accept = shutdown_notify.clone();
        let ha_origins_accept = ha_origins.clone();
        let received_accept = received_cll_origins.clone();
        let server_address = address.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_result = listener.accept() => {
                        match accept_result {
                            Ok((stream, _)) => {
                                let origins = {
                                    let guard = ha_origins_accept.lock().await;
                                    guard.clone().unwrap_or_else(|| vec![
                                        format!("ws://{}", server_address),
                                        format!("ws://{}", server_address),
                                    ])
                                };
                                let clients_clone = clients_accept.clone();
                                let received_clone = received_accept.clone();
                                tokio::spawn(handle_connection(stream, origins, clients_clone, received_clone));
                            }
                            Err(e) => {
                                println!("Error accepting connection: {:?}", e);
                                break;
                            }
                        }
                    }
                    _ = shutdown_accept.notified() => {
                        println!("Shutting down");
                        clients_accept.lock().await.clear();
                        break;
                    }
                }
            }
        });

        let clients_command = clients.clone();
        tokio::spawn(async move {
            while let Some(cmd) = command_receiver.recv().await {
                match cmd {
                    ServerCommand::Send(data) => {
                        let clients = clients_command.lock().await;
                        for client in clients.iter() {
                            let _ = client.send(Message::Binary(data.clone())).await;
                        }
                    }
                    ServerCommand::DropConnections => {
                        println!("Dropping all client connections");
                        clients_command.lock().await.clear();
                    }
                    ServerCommand::CloseConnections => {
                        println!("Sending graceful Close frame to all client connections");
                        let clients = clients_command.lock().await;
                        for client in clients.iter() {
                            let _ = client.send(Message::Close(None)).await;
                        }
                    }
                }
            }
        });

        MockWebSocketServer {
            address,
            command_sender,
            shutdown_notify,
            ha_origins,
            received_cll_origins,
        }
    }

    pub fn address(&self) -> &str {
        &self.address
    }

    pub async fn send_binary(&self, data: Vec<u8>) {
        let _ = self.command_sender.send(ServerCommand::Send(data)).await;
    }

    pub async fn drop_connections(&self) {
        let _ = self
            .command_sender
            .send(ServerCommand::DropConnections)
            .await;
    }

    pub async fn close_connections(&self) {
        let _ = self
            .command_sender
            .send(ServerCommand::CloseConnections)
            .await;
    }

    pub async fn shutdown(&self) {
        self.shutdown_notify.notify_waiters();
    }

    /// Configure the origins returned in the X-Cll-Available-Origins HEAD response.
    /// Call this before Stream::new() is invoked in tests that exercise HA discovery.
    pub async fn set_ha_origins(&self, origins: Vec<String>) {
        *self.ha_origins.lock().await = Some(origins);
    }

    /// Returns the X-Cll-Origin header values captured from all WebSocket upgrade requests.
    /// Some(value) means the header was present; None means it was absent.
    pub async fn get_received_cll_origins(&self) -> Vec<Option<String>> {
        self.received_cll_origins.lock().await.clone()
    }
}

async fn handle_connection(
    mut stream: TcpStream,
    ha_origins: Vec<String>,
    clients: Arc<Mutex<Vec<mpsc::Sender<Message>>>>,
    received_cll_origins: Arc<Mutex<Vec<Option<String>>>>,
) {
    // Peek at first 4 bytes to distinguish HTTP HEAD from WebSocket upgrade.
    // peek() does not consume data, so the full request remains readable by accept_hdr_async.
    let mut peek_buf = [0u8; 4];
    let n = match stream.peek(&mut peek_buf).await {
        Ok(n) => n,
        Err(e) => {
            println!("Peek error: {:?}", e);
            return;
        }
    };

    if n >= 4 && &peek_buf[..4] == b"HEAD" {
        // Consume the HTTP request (drain until blank line)
        let mut buf = [0u8; 4096];
        let _ = stream.read(&mut buf).await;

        let origins_str = ha_origins.join(",");
        let response = format!(
            "HTTP/1.1 200 OK\r\nX-Cll-Available-Origins: {{{}}}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            origins_str
        );
        let _ = stream.write_all(response.as_bytes()).await;
    } else {
        // WebSocket upgrade — capture the X-Cll-Origin header from the upgrade request.
        let (origin_tx, mut origin_rx) = oneshot::channel::<Option<String>>();

        let ws_stream = match accept_hdr_async(stream, move |req: &WsRequest, resp| {
            let origin = req
                .headers()
                .get("x-cll-origin")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());
            let _ = origin_tx.send(origin);
            Ok(resp)
        })
        .await
        {
            Ok(s) => s,
            Err(e) => {
                println!("WebSocket accept error: {:?}", e);
                return;
            }
        };

        // origin_tx.send() has already run by the time accept_hdr_async resolves.
        let origin = origin_rx.try_recv().unwrap_or(None);
        received_cll_origins.lock().await.push(origin);

        println!(
            "Client connected: {}",
            ws_stream.get_ref().peer_addr().unwrap()
        );

        let (mut ws_sender, _) = ws_stream.split();
        let (client_sender, mut client_receiver) = mpsc::channel::<Message>(100);
        clients.lock().await.push(client_sender);

        tokio::spawn(async move {
            while let Some(message) = client_receiver.recv().await {
                if ws_sender.send(message).await.is_err() {
                    break;
                }
            }
            println!("Client connection closed");
        });
    }
}
