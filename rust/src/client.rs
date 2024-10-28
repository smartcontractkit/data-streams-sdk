use crate::auth::{generate_auth_headers, HmacError};
use crate::config::Config;
use crate::endpoints::{
    API_V1_FEEDS, API_V1_REPORTS, API_V1_REPORTS_BULK, API_V1_REPORTS_LATEST, API_V1_REPORTS_PAGE,
};
use crate::feed::{Feed, ID};
use crate::report::Report;

use reqwest::{header::HeaderMap, Client as HttpClient};
use serde::Deserialize;
use serde_urlencoded;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

/// Errors that can occur within the client.
#[derive(Error, Debug)]
pub enum ClientError {
    #[error("HTTP request failed: {0}")]
    HttpRequestError(#[from] reqwest::Error),

    #[error("HMAC generation failed: {0}")]
    HmacError(#[from] HmacError),

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

#[derive(Debug, Deserialize)]
struct ReportsResponse {
    reports: Vec<Report>,
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
            .danger_accept_invalid_certs(config.insecure_skip_verify.to_bool())
            .build()?;

        Ok(Client { config, http })
    }

    /// Returns a list of available feeds.
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/feeds
    /// ```
    ///
    /// # Type:
    /// * HTTP GET
    ///
    /// # Sample request:
    /// ```bash
    /// GET /api/v1/feeds
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
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

        let headers = generate_auth_headers(method, path, body, client_id, user_secret, timestamp)?;

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

        let feeds_response = response.json::<FeedsResponse>().await?;

        Ok(feeds_response.feeds)
    }

    /// Returns a single report with the latest timestamp.
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/reports/latest
    /// ```
    ///
    /// # Type:
    /// * HTTP GET
    ///
    /// # Parameters:
    /// * `feedID` - A Data Streams feed ID.
    ///
    /// # Sample request:
    /// ```bash
    /// GET /api/v1/reports/latest?feedID={feedID}
    /// ```
    ///
    /// # Sample response:
    /// ```json
    /// {
    ///     "report": {
    ///         "feedID": "Hex encoded feedId.",
    ///         "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///         "observationsTimestamp": "Report's latest applicable timestamp (in seconds).",
    ///         "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification."
    ///    }
    /// }
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
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

        let headers =
            generate_auth_headers(method, &path, body, client_id, user_secret, timestamp)?;

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

    /// Returns a single report at a given timestamp.
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/reports
    /// ```
    ///
    /// # Type:
    /// * HTTP GET
    ///
    /// # Parameters:
    /// * `feedID` - A Data Streams feed ID.
    /// * `timestamp` - The Unix timestamp for the report (in seconds).
    ///
    /// # Sample request:
    /// ```bash
    /// GET /api/v1/reports?feedID={feedID}&timestamp={timestamp}
    /// ```
    ///
    /// # Sample response:
    /// ```json
    /// {
    ///     "report": {
    ///         "feedID": "Hex encoded feedId.",
    ///         "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///         "observationsTimestamp": "Report's latest applicable timestamp (in seconds).",
    ///         "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification."
    ///     }
    /// }
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
    pub async fn get_report(
        &self,
        feed_id: ID,
        timestamp: u128,
    ) -> Result<ReportResponse, ClientError> {
        let url = format!("{}{}", self.config.rest_url, API_V1_REPORTS);

        let feed_id = feed_id.to_hex_string();

        let method = "GET";
        let path = format!(
            "{}?feedID={}&timestamp={}",
            API_V1_REPORTS, feed_id, timestamp
        );
        let body = b"";
        let client_id = &self.config.api_key;
        let user_secret = &self.config.api_secret;
        let request_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
            .as_millis()
            .try_into()
            .unwrap();

        let headers = generate_auth_headers(
            method,
            &path,
            body,
            client_id,
            user_secret,
            request_timestamp,
        )?;

        // Make the GET request
        let response = self
            .http
            .get(url)
            .query(&[("feedID", feed_id), ("timestamp", timestamp.to_string())])
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

    /// Returns a report for multiple FeedIDs at a given timestamp.
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/reports/bulk
    /// ```
    /// # Type:
    /// * HTTP GET
    ///
    /// # Parameters:
    /// * `feedIDs` - A comma-separated list of Data Streams feed IDs.
    /// * `timestamp` - The Unix timestamp for the reports (in seconds).
    ///
    /// # Sample request:
    /// ```bash
    /// GET /api/v1/reports/bulk?feedIDs={FeedID1},{FeedID2},...&timestamp={timestamp}
    /// ```
    ///
    /// # Sample response:
    /// ```json
    /// {
    ///     "reports": [
    ///         {
    ///             "feedID": "Hex encoded feedId.",
    ///             "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///             "observationsTimestamp": "Report's latest applicable timestamp (in seconds).",
    ///             "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification."
    ///         },
    ///         //...
    ///     ]
    /// }
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
    /// | **206 Missing Data** | Indicates that at least one feed ID data is missing from the report. E.g., you requested a report for feed IDs `<feedID1>`, `<feedID2>`, and `<feedID3>` at a given timestamp. If data for `<feedID2>` is missing from the report (not available yet at the specified timestamp), you get `[<feedID1 data>, <feedID3 data>]` and a 206 response. |
    pub async fn get_reports_bulk(
        &self,
        feed_ids: Vec<ID>,
        timestamp: u128,
    ) -> Result<Vec<Report>, ClientError> {
        let url = format!("{}{}", self.config.rest_url, API_V1_REPORTS_BULK);

        let feed_ids: Vec<String> = feed_ids.iter().map(|id| id.to_hex_string()).collect();
        let feed_ids_joined = feed_ids.join(",");

        let timestamp_str = timestamp.to_string();

        let query_params = &[
            ("feedIDs", feed_ids_joined.as_str()),
            ("timestamp", timestamp_str.as_str()),
        ];

        let query_string = serde_urlencoded::to_string(query_params).unwrap();

        let method = "GET";
        let path = format!("{}?{}", API_V1_REPORTS_BULK, query_string);
        let body = b"";
        let client_id = &self.config.api_key;
        let user_secret = &self.config.api_secret;
        let request_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
            .as_millis()
            .try_into()
            .unwrap();

        let headers = generate_auth_headers(
            method,
            &path,
            body,
            client_id,
            user_secret,
            request_timestamp,
        )?;

        // Make the GET request
        let response = self
            .http
            .get(url)
            .query(query_params)
            .headers(headers)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| ClientError::ApiError(e.to_string()))?;

        // Optionally inspect the response
        if let Some(ref inspect_fn) = self.config.inspect_http_response {
            inspect_fn(&response);
        }

        let reports_response = response.json::<ReportsResponse>().await?;

        let reports = reports_response.reports;

        Ok(reports)
    }

    /// Returns multiple sequential reports for a single FeedID, starting at a given timestamp
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/reports
    /// ```
    ///
    /// # Type:
    /// * HTTP GET
    ///
    /// # Parameters:
    /// * `feedID` - A Data Streams feed ID.
    /// * `startTimestamp` - The UNIX timestamp for the first report (in seconds).
    ///
    /// # Sample request:
    /// ```bash
    /// GET /api/v1/reports/page?feedID={FeedID}&startTimestamp={StartTimestamp}
    /// ```
    ///
    /// # Sample response:
    /// ```json
    /// {
    ///     "reports": [
    ///         {
    ///             "feedID": "Hex encoded feedId.",
    ///             "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///             "observationsTimestamp": "Report's latest applicable timestamp (in seconds).",
    ///             "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification."
    ///         },
    ///         //...
    ///     ]
    /// }
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
    pub async fn get_reports_page(
        &self,
        feed_id: ID,
        start_timestamp: u128,
    ) -> Result<Vec<Report>, ClientError> {
        let url = format!("{}{}", self.config.rest_url, API_V1_REPORTS_PAGE);

        let feed_id = feed_id.to_hex_string();

        let method = "GET";
        let path = format!(
            "{}?feedID={}&startTimestamp={}",
            API_V1_REPORTS_PAGE, feed_id, start_timestamp
        );
        let body = b"";
        let client_id = &self.config.api_key;
        let user_secret = &self.config.api_secret;
        let request_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
            .as_millis()
            .try_into()
            .unwrap();

        let headers = generate_auth_headers(
            method,
            &path,
            body,
            client_id,
            user_secret,
            request_timestamp,
        )?;

        // Make the GET request
        let response = self
            .http
            .get(url)
            .query(&[
                ("feedID", feed_id),
                ("startTimestamp", start_timestamp.to_string()),
            ])
            .headers(headers)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| ClientError::ApiError(e.to_string()))?;

        // Optionally inspect the response
        if let Some(ref inspect_fn) = self.config.inspect_http_response {
            inspect_fn(&response);
        }

        let reports_response = response.json::<ReportsResponse>().await?;

        let reports = reports_response.reports;

        Ok(reports)
    }

    /// Returns multiple sequential reports for a single FeedID, starting at a given timestamp
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/reports
    /// ```
    ///
    /// # Type:
    /// * HTTP GET
    ///
    /// # Parameters:
    /// * `feedID` - A Data Streams feed ID.
    /// * `startTimestamp` - The UNIX timestamp for the first report (in seconds).
    /// * `limit` - The number of reports to return
    ///
    /// # Sample request:
    /// ```bash
    /// GET /api/v1/reports/page?feedID={FeedID}&startTimestamp={StartTimestamp}&limit={Limit}
    /// ```
    ///
    /// # Sample response:
    /// ```json
    /// {
    ///     "reports": [
    ///         {
    ///             "feedID": "Hex encoded feedId.",
    ///             "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///             "observationsTimestamp": "Report's latest applicable timestamp (in seconds).",
    ///             "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification."
    ///         },
    ///         //...
    ///     ]
    /// }
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
    pub async fn get_reports_page_with_limit(
        &self,
        feed_id: ID,
        start_timestamp: u128,
        limit: usize,
    ) -> Result<Vec<Report>, ClientError> {
        let url = format!("{}{}", self.config.rest_url, API_V1_REPORTS_PAGE);

        let feed_id = feed_id.to_hex_string();

        let method = "GET";
        let path = format!(
            "{}?feedID={}&startTimestamp={}&limit={}",
            API_V1_REPORTS_PAGE, feed_id, start_timestamp, limit
        );
        let body = b"";
        let client_id = &self.config.api_key;
        let user_secret = &self.config.api_secret;
        let request_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
            .as_millis()
            .try_into()
            .unwrap();

        let headers = generate_auth_headers(
            method,
            &path,
            body,
            client_id,
            user_secret,
            request_timestamp,
        )?;

        // Make the GET request
        let response = self
            .http
            .get(url)
            .query(&[
                ("feedID", feed_id),
                ("startTimestamp", start_timestamp.to_string()),
                ("limit", limit.to_string()),
            ])
            .headers(headers)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| ClientError::ApiError(e.to_string()))?;

        // Optionally inspect the response
        if let Some(ref inspect_fn) = self.config.inspect_http_response {
            inspect_fn(&response);
        }

        let reports_response = response.json::<ReportsResponse>().await?;

        let reports = reports_response.reports;

        Ok(reports)
    }
}
