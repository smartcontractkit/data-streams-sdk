use reqwest::Response;
use std::sync::Arc;
use thiserror::Error;
use zeroize::Zeroize;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("API key cannot be empty")]
    EmptyApiKey,

    #[error("API secret cannot be empty")]
    EmptyApiSecret,
}

/// Config specifies the client configuration and dependencies.
pub struct Config {
    /// Client API key
    pub api_key: String,

    /// Client API secret
    pub api_secret: String,

    /// REST API URL
    pub rest_url: String,

    /// WebSocket API URL
    pub ws_url: String,

    /// Use concurrent connections to multiple Streams servers
    pub ws_ha: bool,

    /// Maximum number of reconnection attempts for underlying WebSocket connections
    pub ws_max_reconnect: u32,

    /// Skip server certificate chain and host name verification
    pub insecure_skip_verify: bool,

    /// Function to inspect HTTP responses for REST requests.
    /// The response object must not be modified.
    pub inspect_http_response: Option<Arc<dyn Fn(&Response) + Send + Sync>>,
}

impl Config {
    const DEFAULT_WS_MAX_RECONNECT: u32 = 5;

    /// Creates a new `Config` instance with the provided parameters.
    ///
    /// # Arguments
    ///
    /// * `api_key` - Client API key for authentication.
    /// * `api_secret` - Client API secret for signing requests.
    /// * `rest_url` - REST API base URL.
    /// * `ws_url` - WebSocket API base URL.
    /// * `ws_ha` - Enable high availability for WebSocket connections.
    /// * `ws_max_reconnect` - Maximum reconnection attempts for WebSocket (optional, defaults to 5).
    /// * `insecure_skip_verify` - Skip TLS certificate verification (use with caution).
    /// * `inspect_http_response` - Optional callback to inspect HTTP responses.
    ///
    /// # Errors
    ///
    /// Returns `ConfigError` if any of the provided parameters are invalid.
    pub fn new(
        api_key: String,
        api_secret: String,
        rest_url: String,
        ws_url: String,
        ws_ha: bool,
        ws_max_reconnect: Option<u32>,
        insecure_skip_verify: bool,
        inspect_http_response: Option<Arc<dyn Fn(&Response) + Send + Sync>>,
    ) -> Result<Self, ConfigError> {
        if api_key.trim().is_empty() {
            return Err(ConfigError::EmptyApiKey);
        }

        if api_secret.trim().is_empty() {
            return Err(ConfigError::EmptyApiSecret);
        }

        Ok(Config {
            api_key,
            api_secret,
            rest_url,
            ws_url,
            ws_ha,
            ws_max_reconnect: ws_max_reconnect.unwrap_or(Self::DEFAULT_WS_MAX_RECONNECT),
            insecure_skip_verify,
            inspect_http_response,
        })
    }
}

impl Zeroize for Config {
    fn zeroize(&mut self) {
        self.api_key.zeroize();
        self.api_secret.zeroize();
    }
}

impl Drop for Config {
    fn drop(&mut self) {
        self.zeroize();
    }
}
