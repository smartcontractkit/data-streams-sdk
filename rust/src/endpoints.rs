use reqwest::header::HeaderName;
use std::str::FromStr;
use std::sync::OnceLock;

pub const API_V1_WS: &str = "/api/v1/ws";
pub const API_V1_FEEDS: &str = "/api/v1/feeds";
pub const API_V1_REPORTS: &str = "/api/v1/reports";
pub const API_V1_REPORTS_BULK: &str = "/api/v1/reports/bulk";
pub const API_V1_REPORTS_PAGE: &str = "/api/v1/reports/page";
pub const API_V1_REPORTS_LATEST: &str = "/api/v1/reports/latest";

/// Custom context key for passing custom HTTP headers
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CtxKey(&'static str);

impl CtxKey {
    pub const CUSTOM_HEADERS: CtxKey = CtxKey("CustomHeaders");
}

/// HTTP Header constants using `HeaderName` with `OnceLock` for lazy initialization
static CLL_AVAIL_ORIGINS_HEADER: OnceLock<HeaderName> = OnceLock::new();
static CLL_ORIGIN_HEADER: OnceLock<HeaderName> = OnceLock::new();
static CLL_INT_HEADER: OnceLock<HeaderName> = OnceLock::new();
static AUTHZ_HEADER: OnceLock<HeaderName> = OnceLock::new();
static AUTHZ_TS_HEADER: OnceLock<HeaderName> = OnceLock::new();
static AUTHZ_SIG_HEADER: OnceLock<HeaderName> = OnceLock::new();
static HOST_HEADER: OnceLock<HeaderName> = OnceLock::new();

/// Functions to retrieve header constants, initializing them on first access

/// "X-Cll-Available-Origins"
pub fn get_cll_avail_origins_header() -> &'static HeaderName {
    CLL_AVAIL_ORIGINS_HEADER.get_or_init(|| {
        HeaderName::from_str("X-Cll-Available-Origins")
            .expect("Invalid header name: X-Cll-Available-Origins")
    })
}

/// "X-Cll-Origin"
pub fn get_cll_origin_header() -> &'static HeaderName {
    CLL_ORIGIN_HEADER.get_or_init(|| {
        HeaderName::from_str("X-Cll-Origin").expect("Invalid header name: X-Cll-Origin")
    })
}

/// "X-Cll-Eng-Int"
pub fn get_cll_int_header() -> &'static HeaderName {
    CLL_INT_HEADER.get_or_init(|| {
        HeaderName::from_str("X-Cll-Eng-Int").expect("Invalid header name: X-Cll-Eng-Int")
    })
}

/// "Authorization"
pub fn get_authz_header() -> &'static HeaderName {
    AUTHZ_HEADER.get_or_init(|| {
        HeaderName::from_str("Authorization").expect("Invalid header name: Authorization")
    })
}

/// "X-Authorization-Timestamp"
pub fn get_authz_ts_header() -> &'static HeaderName {
    AUTHZ_TS_HEADER.get_or_init(|| {
        HeaderName::from_str("X-Authorization-Timestamp")
            .expect("Invalid header name: X-Authorization-Timestamp")
    })
}

/// "X-Authorization-Signature-SHA256"
pub fn get_authz_sig_header() -> &'static HeaderName {
    AUTHZ_SIG_HEADER.get_or_init(|| {
        HeaderName::from_str("X-Authorization-Signature-SHA256")
            .expect("Invalid header name: X-Authorization-Signature-SHA256")
    })
}

/// "Host"
pub fn get_host_header() -> &'static HeaderName {
    HOST_HEADER.get_or_init(|| HeaderName::from_str("Host").expect("Invalid header name: Host"))
}
