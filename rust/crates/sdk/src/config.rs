use reqwest::Response;
use thiserror::Error;
use zeroize::Zeroize;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("API key cannot be empty")]
    EmptyApiKey,

    #[error("API secret cannot be empty")]
    EmptyApiSecret,
}

#[derive(Clone, PartialEq, Eq)]
pub enum WebSocketHighAvailability {
    Enabled,
    Disabled,
}

#[derive(Clone, PartialEq, Eq)]
pub enum InsecureSkipVerify {
    Enabled,
    Disabled,
}

impl InsecureSkipVerify {
    /// Converts `InsecureSkipVerify` enum to a boolean.
    pub fn to_bool(&self) -> bool {
        match self {
            InsecureSkipVerify::Enabled => true,
            InsecureSkipVerify::Disabled => false,
        }
    }
}

/// Config specifies the client configuration and dependencies.
#[derive(Clone)]
pub struct Config {
    /// Client API key
    pub api_key: String,

    /// Client API secret
    pub api_secret: String,

    /// REST API URL
    pub rest_url: String,

    /// WebSocket API URL
    pub ws_url: String,

    /// High Availability Mode: Use concurrent connections to multiple Streams servers
    pub ws_ha: WebSocketHighAvailability,

    /// Maximum number of reconnection attempts for underlying WebSocket connections
    pub ws_max_reconnect: usize,

    /// Skip server certificate chain and host name verification
    pub insecure_skip_verify: InsecureSkipVerify,

    /// Function to inspect HTTP responses for REST requests.
    /// The response object must not be modified.
    pub inspect_http_response: Option<fn(&Response)>,
}

impl Config {
    const DEFAULT_WS_MAX_RECONNECT: usize = 5;
    const DEFAULT_WS_HA: WebSocketHighAvailability = WebSocketHighAvailability::Disabled;
    const DEFAULT_INSECURE_SKIP_VERIFY: InsecureSkipVerify = InsecureSkipVerify::Disabled;
    const DEFAULT_INSPECT_HTTP_RESPONSE: Option<fn(&Response)> = None;

    /// Creates a new `Config` instance with the provided parameters. (Builder pattern)
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
    ///
    /// # Example
    /// ```rust
    /// use data_streams_sdk::config::{Config, WebSocketHighAvailability, InsecureSkipVerify};
    ///
    /// use std::error::Error;
    ///
    /// #[tokio::main]
    /// async fn main() -> Result<(), Box<dyn Error>> {
    ///    let api_key = "YOUR_API_KEY_GOES_HERE";
    ///    let user_secret = "YOUR_USER_SECRET_GOES_HERE";
    ///    let rest_url = "https://api.testnet-dataengine.chain.link";
    ///    let ws_url = "wss://api.testnet-dataengine.chain.link/ws";
    ///
    ///    // Initialize the basic configuration
    ///    let config = Config::new(
    ///        api_key.to_string(),
    ///        user_secret.to_string(),
    ///        rest_url.to_string(),
    ///        ws_url.to_string(),
    ///    )
    ///    .build()?;
    ///
    ///    // If you want to customize the configuration further, use the builder pattern
    ///    let ws_urls_multiple = "wss://api.testnet-dataengine.chain.link/ws,wss://api.testnet-dataengine.chain.link/ws";
    ///    
    ///    let configCustom = Config::new(
    ///        api_key.to_string(),
    ///        user_secret.to_string(),
    ///        rest_url.to_string(),
    ///        ws_urls_multiple.to_string(),
    ///    )
    ///    .with_ws_ha(WebSocketHighAvailability::Enabled) // Enable WebSocket High Availability Mode
    ///    .with_ws_max_reconnect(10) // Set maximum reconnection attempts to 10, instead of the default 5.
    ///    .with_insecure_skip_verify(InsecureSkipVerify::Enabled) // Skip TLS certificate verification, use with caution. This is disabled by default.
    ///    .with_inspect_http_response(|response| {
    ///         // Custom logic to inspect the HTTP response here
    ///         println!("Received response with status: {}", response.status());
    ///     })
    ///    .build()?;
    ///
    ///    Ok(())
    /// }
    /// ```
    pub fn new(
        api_key: String,
        api_secret: String,
        rest_url: String,
        ws_url: String,
    ) -> ConfigBuilder {
        ConfigBuilder {
            api_key,
            api_secret,
            rest_url,
            ws_url,
            ws_ha: Self::DEFAULT_WS_HA,
            ws_max_reconnect: Self::DEFAULT_WS_MAX_RECONNECT,
            insecure_skip_verify: Self::DEFAULT_INSECURE_SKIP_VERIFY,
            inspect_http_response: Self::DEFAULT_INSPECT_HTTP_RESPONSE,
        }
    }
}

impl Drop for Config {
    fn drop(&mut self) {
        self.api_key.zeroize();
        self.api_secret.zeroize();
    }
}

pub struct ConfigBuilder {
    api_key: String,
    api_secret: String,
    rest_url: String,
    ws_url: String,
    ws_ha: WebSocketHighAvailability,
    ws_max_reconnect: usize,
    insecure_skip_verify: InsecureSkipVerify,
    inspect_http_response: Option<fn(&Response)>,
}

impl ConfigBuilder {
    /// Sets the `ws_ha` parameter.
    pub fn with_ws_ha(mut self, ws_ha: WebSocketHighAvailability) -> Self {
        self.ws_ha = ws_ha;
        self
    }

    // Sets the `ws_max_reconnect` parameter.
    pub fn with_ws_max_reconnect(mut self, ws_max_reconnect: usize) -> Self {
        self.ws_max_reconnect = ws_max_reconnect;
        self
    }

    /// Sets the `insecure_skip_verify` parameter.
    pub fn with_insecure_skip_verify(mut self, insecure_skip_verify: InsecureSkipVerify) -> Self {
        self.insecure_skip_verify = insecure_skip_verify;
        self
    }

    /// Sets the `inspect_http_response` parameter.
    pub fn with_inspect_http_response(mut self, inspect_http_response: fn(&Response)) -> Self {
        self.inspect_http_response = Some(inspect_http_response);
        self
    }

    /// Builds the `Config` instance.
    pub fn build(self) -> Result<Config, ConfigError> {
        if self.api_key.trim().is_empty() {
            return Err(ConfigError::EmptyApiKey);
        }

        if self.api_secret.trim().is_empty() {
            return Err(ConfigError::EmptyApiSecret);
        }

        Ok(Config {
            api_key: self.api_key,
            api_secret: self.api_secret,
            rest_url: self.rest_url,
            ws_url: self.ws_url,
            ws_ha: self.ws_ha,
            ws_max_reconnect: self.ws_max_reconnect,
            insecure_skip_verify: self.insecure_skip_verify,
            inspect_http_response: self.inspect_http_response,
        })
    }
}
