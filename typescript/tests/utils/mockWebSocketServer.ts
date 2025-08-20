import { WebSocket, WebSocketServer } from "ws";
import { AddressInfo } from "net";

export class MockWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private address: string = "";
  private isReady: boolean = false;

  constructor() {
    this.start();
  }

  private start() {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ port: 0 });
    this.setupServer();
  }

  private setupServer() {
    if (!this.wss) return;

    this.wss.on("listening", () => {
      if (!this.wss) return;
      const addr = this.wss.address() as AddressInfo;
      this.address = `127.0.0.1:${addr.port}`;
      this.isReady = true;
    });

    this.wss.on("error", error => {
      console.error("WebSocket server error:", error);
      this.isReady = false;
    });

    this.wss.on("connection", (ws: WebSocket) => {
      // Set up error handling first
      ws.on("error", error => {
        console.error("WebSocket connection error:", error);
        this.clients.delete(ws);
        try {
          ws.close();
        } catch {
          // Ignore close errors
        }
      });

      // Handle pings to keep connection alive
      ws.on("ping", () => {
        try {
          ws.pong();
        } catch {
          // Ignore pong errors
        }
      });

      this.clients.add(ws);

      ws.on("close", () => {
        this.clients.delete(ws);
      });
    });
  }

  public async waitForReady(timeout = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.isReady && this.address) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  public getAddress(): string {
    return this.isReady ? this.address : "";
  }

  public broadcast(data: Buffer | string) {
    if (!this.isReady) return;

    const deadClients = new Set<WebSocket>();

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error("Error broadcasting to client:", error);
          deadClients.add(client);
        }
      } else {
        deadClients.add(client);
      }
    });

    // Clean up dead clients
    deadClients.forEach(client => {
      this.clients.delete(client);
      try {
        client.close();
      } catch {
        // Ignore close errors
      }
    });
  }

  public async closeAllConnections(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    this.clients.forEach(client => {
      closePromises.push(
        new Promise(resolve => {
          const timeout = setTimeout(() => {
            try {
              client.terminate();
            } catch {
              // Ignore terminate errors
            }
            resolve();
          }, 1000);

          client.on("close", () => {
            clearTimeout(timeout);
            resolve();
          });

          try {
            client.close();
          } catch {
            clearTimeout(timeout);
            resolve();
          }
        })
      );
    });

    await Promise.all(closePromises);
    this.clients.clear();
  }

  /**
   * Simulate temporary disconnections that trigger reconnection attempts
   * Unlike closeAllConnections, this doesn't clear the client set entirely
   */
  public simulateNetworkInterruption(): void {
    const clientsToDisconnect = Array.from(this.clients);

    clientsToDisconnect.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          // Send close frame to simulate network disconnection
          client.close(1006, "Network interruption simulation");
        } catch {
          // Ignore close errors
        }
      }
    });

    // Remove disconnected clients from tracking
    // but don't clear the entire set - new connections can still come in
    this.clients.clear();
  }

  /**
   * Simulate realistic connection drops that will trigger SDK reconnection logic
   * This closes connections but keeps the server running to accept reconnections
   */
  public simulateConnectionDrops(dropCount?: number): void {
    const clientsArray = Array.from(this.clients);
    const toDrop = dropCount || clientsArray.length;

    for (let i = 0; i < Math.min(toDrop, clientsArray.length); i++) {
      const client = clientsArray[i];
      if (client.readyState === WebSocket.OPEN) {
        try {
          // Simulate unexpected disconnection (code 1006 = abnormal closure)
          client.terminate(); // Force close without handshake
        } catch {
          // Ignore errors
        }
      }
      this.clients.delete(client);
    }
  }

  /**
   * Get current connection count for testing
   */
  public getActiveConnectionCount(): number {
    return Array.from(this.clients).filter(client => client.readyState === WebSocket.OPEN).length;
  }

  public async close(): Promise<void> {
    this.isReady = false;
    this.address = "";

    await this.closeAllConnections();

    return new Promise<void>(resolve => {
      if (!this.wss) {
        resolve();
        return;
      }

      const wss = this.wss;
      this.wss = null;

      const timeout = setTimeout(() => {
        try {
          wss.close();
        } catch {
          // Ignore close errors
        }
        resolve();
      }, 1000);

      try {
        wss.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      } catch {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  public getConnectedClientsCount(): number {
    return Array.from(this.clients).filter(client => client.readyState === WebSocket.OPEN).length;
  }
}
