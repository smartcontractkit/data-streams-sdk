use crate::endpoints::{
    get_authz_header, get_authz_sig_header, get_authz_ts_header, API_V1_FEEDS, API_V1_REPORTS_BULK,
};

use hmac::{Hmac, Mac};
use reqwest::header::{HeaderMap, HeaderValue};
use sha2::{Digest, Sha256};
use std::error::Error;

type HmacSha256 = Hmac<Sha256>;

fn generate_hmac(
    method: &str,
    path: &str,
    body: &[u8],
    client_id: &str,
    timestamp: i64,
    user_secret: &str,
) -> Result<String, Box<dyn Error>> {
    let mut hasher = Sha256::new();
    hasher.update(body);
    let server_body_hash = hasher.finalize();
    let server_body_hash_hex = hex::encode(server_body_hash);

    // Create the server body hash string
    let server_body_hash_string = format!(
        "{} {} {} {} {}",
        method, path, server_body_hash_hex, client_id, timestamp
    );

    // Compute HMAC-SHA256 of the server body hash string
    let mut mac = HmacSha256::new_from_slice(user_secret.as_bytes())?;
    mac.update(server_body_hash_string.as_bytes());
    let signed_message = mac.finalize();
    let signed_message_bytes = signed_message.into_bytes();
    let user_hmac = hex::encode(signed_message_bytes);

    Ok(user_hmac)
}

fn generate_auth_headers(
    headers: &mut HeaderMap,
    method: &str,
    path: &str,
    body: &[u8],
    client_id: &str,
    user_secret: &str,
    timestamp: i64,
) -> Result<(), Box<dyn Error>> {
    let hmac_string = generate_hmac(method, path, body, client_id, timestamp, user_secret)?;

    headers.insert(get_authz_header(), HeaderValue::from_str(client_id)?);
    headers.insert(
        get_authz_ts_header(),
        HeaderValue::from_str(&timestamp.to_string())?,
    );
    headers.insert(get_authz_sig_header(), HeaderValue::from_str(&hmac_string)?);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_hmac_valid1() {
        let method = "GET";
        let path = API_V1_FEEDS;
        let body = b"";
        let client_id = "clientId";
        let user_secret = "userSecret";
        let timestamp = 1718885772;

        let want = "e9b2aa1deb13b2abd078353a5e335b2f50307159ad28b433157d2c74dbab2072";
        let got = generate_hmac(method, path, body, client_id, timestamp, user_secret).unwrap();

        assert_eq!(got, want);
    }

    #[test]
    fn generate_hmac_valid2() {
        let method = "POST";
        let path = API_V1_FEEDS;
        let body = b"";
        let client_id = "clientId1";
        let user_secret = "secret1";
        let timestamp = 12000;

        let want = "31b48ebdb13802b58978cd89eca0c3c68ddccf85392e703b55942544e7203d3d";
        let got = generate_hmac(method, path, body, client_id, timestamp, user_secret).unwrap();

        assert_eq!(got, want);
    }

    #[test]
    fn generate_hmac_valid3() {
        let method = "POST";
        let path = API_V1_REPORTS_BULK;
        let body = b"{\"attr1\": \"value1\",\"attr2\": [1,2,3]}";
        let client_id = "clientId2";
        let user_secret = "secret2";
        let timestamp = 1718885772;

        let want = "37190febe20b6f3662f6abbfa3a7085ad705ac64e88bde8c1a01a635859e6cf7";
        let got = generate_hmac(method, path, body, client_id, timestamp, user_secret).unwrap();

        assert_eq!(got, want);
    }

    #[test]
    fn generate_auth_headers_valid1() {
        let method = "GET";
        let path = API_V1_FEEDS;
        let body = b"";
        let client_id = "authzHeader";
        let user_secret = "userSecret";
        let timestamp = 1718885772;

        let mut headers = HeaderMap::new();
        generate_auth_headers(
            &mut headers,
            method,
            path,
            body,
            client_id,
            user_secret,
            timestamp,
        )
        .unwrap();

        let want_authz_header = HeaderValue::from_str(client_id).unwrap();
        let want_authz_ts_header = HeaderValue::from_str(&timestamp.to_string()).unwrap();
        let want_authz_sig_header = HeaderValue::from_str(
            "53373f7564f6c53905a3943ef3f3491709fac1b864a2991b63d0d3048b47317c",
        )
        .unwrap();

        assert_eq!(headers.get(get_authz_header()), Some(&want_authz_header));
        assert_eq!(
            headers.get(get_authz_ts_header()),
            Some(&want_authz_ts_header)
        );
        assert_eq!(
            headers.get(get_authz_sig_header()),
            Some(&want_authz_sig_header)
        );
    }

    #[test]
    fn generate_auth_headers_valid2() {
        let method = "POST";
        let path = API_V1_FEEDS;
        let body = b"";
        let client_id = "authzHeader";
        let user_secret = "userSecret";
        let timestamp = 12000;

        let mut headers = HeaderMap::new();
        generate_auth_headers(
            &mut headers,
            method,
            path,
            body,
            client_id,
            user_secret,
            timestamp,
        )
        .unwrap();

        let want_authz_header = HeaderValue::from_str(client_id).unwrap();
        let want_authz_ts_header = HeaderValue::from_str(&timestamp.to_string()).unwrap();
        let want_authz_sig_header = HeaderValue::from_str(
            "4bb71f74be80aba504107893b90324858bea82189c600e336e219702c15f2660",
        )
        .unwrap();

        assert_eq!(headers.get(get_authz_header()), Some(&want_authz_header));
        assert_eq!(
            headers.get(get_authz_ts_header()),
            Some(&want_authz_ts_header)
        );
        assert_eq!(
            headers.get(get_authz_sig_header()),
            Some(&want_authz_sig_header)
        );
    }

    #[test]
    fn generate_auth_headers_valid3() {
        let method = "POST";
        let path = API_V1_REPORTS_BULK;
        let body = b"{\"attr1\": \"value1\",\"attr2\": [1,2,3]}";
        let client_id = "authzHeader";
        let user_secret = "userSecret";
        let timestamp = 1718885772;

        let mut headers = HeaderMap::new();
        generate_auth_headers(
            &mut headers,
            method,
            path,
            body,
            client_id,
            user_secret,
            timestamp,
        )
        .unwrap();

        let want_authz_header = HeaderValue::from_str(client_id).unwrap();
        let want_authz_ts_header = HeaderValue::from_str(&timestamp.to_string()).unwrap();
        let want_authz_sig_header = HeaderValue::from_str(
            "adfdba180f94d4e1445f08e7a65d3c3cc34d9885aa67527a68789661147897ed",
        )
        .unwrap();

        assert_eq!(headers.get(get_authz_header()), Some(&want_authz_header));
        assert_eq!(
            headers.get(get_authz_ts_header()),
            Some(&want_authz_ts_header)
        );
        assert_eq!(
            headers.get(get_authz_sig_header()),
            Some(&want_authz_sig_header)
        );
    }
}
