use crate::auth::generate_auth_headers;
use crate::config::Config;
use crate::endpoints::{API_V1_FEEDS, API_V1_REPORTS_LATEST};
use crate::feed::{Feed, ID};
use crate::report::Report;

use reqwest::{header::HeaderMap, Client as HttpClient};
use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

/// Errors that can occur within the client.
#[derive(Error, Debug)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    HttpRequestError(#[from] reqwest::Error),

    #[error("HMAC generation failed: {0}")]
    HmacError(#[from] Box<dyn std::error::Error>),

    #[error("Invalid response format: {0}")]
    InvalidResponseFormat(#[from] serde_json::Error),

    #[error("API error: {0}")]
    ApiError(String),
}

#[derive(Debug, Deserialize)]
struct FeedsResponse {
    feeds: Vec<Feed>,
}

#[derive(Debug, Deserialize)]
pub struct ReportResponse {
    pub report: Report,
}

pub struct Client {
    config: Config,
    http: HttpClient,
}

impl Client {
    /// Creates a new `Client` instance using the provided `Config`.
    ///
    /// # Arguments
    ///
    /// * `config` - A validated `Config` instance.
    ///
    /// # Errors
    ///
    /// Returns an error if the HTTP client fails to initialize.
    pub fn new(config: Config) -> Result<Self, reqwest::Error> {
        let http = HttpClient::builder()
            .danger_accept_invalid_certs(config.insecure_skip_verify)
            .build()?;

        Ok(Client { config, http })
    }

    /// Returns a list of available feeds.
    ///
    /// Endpoint: /api/v1/feeds
    /// Type: HTTP GET
    ///
    /// Sample request:
    /// GET /api/v1/feeds
    pub async fn get_feeds(&self) -> Result<Vec<Feed>, ClientError> {
        let url = format!("{}{}", self.config.rest_url, API_V1_FEEDS);

        let method = "GET";
        let path = API_V1_FEEDS;
        let body = b"";
        let client_id = &self.config.api_key;
        let user_secret = &self.config.api_secret;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
            .as_millis()
            .try_into()
            .unwrap();

        let mut headers = HeaderMap::new();
        generate_auth_headers(
            &mut headers,
            method,
            path,
            body,
            client_id,
            user_secret,
            timestamp,
        )?;

        // Make the GET request
        let response = self
            .http
            .get(url)
            .headers(headers)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| ClientError::ApiError(e.to_string()))?;

        // Optionally inspect the response
        if let Some(ref inspect_fn) = self.config.inspect_http_response {
            inspect_fn(&response);
        }

        // let r = response.text().await?;
        // println!("Response: {:?}", r);

        let feeds_response = response.json::<FeedsResponse>().await?;

        Ok(feeds_response.feeds)
    }

    /// Returns a single report with the latest timestamp.
    ///
    /// Endpoint: /api/v1/reports/latest
    /// Type: HTTP GET
    /// Parameters: feedID - A Data Streams feed ID.
    ///
    /// Sample request:
    /// GET /api/v1/reports/latest?feedID=<feedID>
    ///
    /// Sample response:
    /// {
    ///     "report": {
    ///         "feedID": "Hex encoded feedId.",
    ///         "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///         "observationsTimestamp": "Report's latest applicable timestamp (in seconds).",
    ///         "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification."
    ///    }
    /// }
    pub async fn get_latest_report(&self, feed_id: ID) -> Result<ReportResponse, ClientError> {
        let url = format!("{}{}", self.config.rest_url, API_V1_REPORTS_LATEST);

        let feed_id = feed_id.to_hex_string();

        let method = "GET";
        let path = format!("{}?feedID={}", API_V1_REPORTS_LATEST, feed_id);
        let body = b"";
        let client_id = &self.config.api_key;
        let user_secret = &self.config.api_secret;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
            .as_millis()
            .try_into()
            .unwrap();

        let mut headers = HeaderMap::new();
        generate_auth_headers(
            &mut headers,
            method,
            &path,
            body,
            client_id,
            user_secret,
            timestamp,
        )?;

        // Make the GET request
        let response = self
            .http
            .get(url)
            .query(&[("feedID", feed_id)])
            .headers(headers)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| ClientError::ApiError(e.to_string()))?;

        // Optionally inspect the response
        if let Some(ref inspect_fn) = self.config.inspect_http_response {
            inspect_fn(&response);
        }

        let report_response = response.json::<ReportResponse>().await?;

        Ok(report_response)
    }
}
