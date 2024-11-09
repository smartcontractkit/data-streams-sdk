use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::{
    net::TcpListener,
    sync::{mpsc, Mutex, Notify},
};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};

enum ServerCommand {
    Send(Vec<u8>),
    DropConnections,
}

#[derive(Clone)]
pub struct MockWebSocketServer {
    address: String,
    command_sender: mpsc::Sender<ServerCommand>,
    shutdown_notify: Arc<Notify>,
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

        let clients_accept = clients.clone();
        let shutdown_accept = shutdown_notify.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_result = listener.accept() => {
                        match accept_result {
                            Ok((stream, _)) => {
                                let ws_stream = accept_async(stream)
                                    .await
                                    .expect("Failed to accept connection");
                                println!(
                                    "Client connected: {}",
                                    ws_stream.get_ref().peer_addr().unwrap()
                                );

                                let (mut ws_sender, _) = ws_stream.split();
                                let (client_sender, mut client_receiver) =
                                    mpsc::channel::<Message>(100);

                                clients_accept.lock().await.push(client_sender);

                                // Spawn a task to forward messages from the server to the client.
                                tokio::spawn(async move {
                                    while let Some(message) = client_receiver.recv().await {
                                        if ws_sender.send(message).await.is_err() {
                                            break;
                                        }
                                    }
                                    println!("Client connection closed");
                                });

                                // Ignore messages from the client. There will none in this test.
                            }
                            Err(e) => {
                                println!("Error accepting connection: {:?}", e);
                                break;
                            }
                        }
                    }
                    // Listen for shutdown signal.
                    _ = shutdown_accept.notified() => {
                        println!("Shutting down");
                        let mut clients = clients_accept.lock().await;
                        clients.clear();
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
                        let mut clients = clients_command.lock().await;
                        clients.clear();
                    }
                }
            }
        });

        MockWebSocketServer {
            address,
            command_sender,
            shutdown_notify,
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

    pub async fn shutdown(&self) {
        self.shutdown_notify.notify_waiters();
    }
}
