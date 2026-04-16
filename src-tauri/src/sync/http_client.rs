use reqwest::Client;

use super::types::{PushResponse, SyncError, SyncPayload};

pub struct SyncClient {
    base_url: String,
    token: String,
    client: Client,
}

impl SyncClient {
    pub fn new(base_url: &str, token: &str) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_default();
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
            client,
        }
    }

    /// Verify the auth token is valid.
    pub async fn verify_auth(&self) -> Result<bool, SyncError> {
        let resp = self
            .client
            .post(format!("{}/auth/verify", self.base_url))
            .bearer_auth(&self.token)
            .send()
            .await?;

        if resp.status().as_u16() == 401 {
            return Err(SyncError::Auth("Invalid token".into()));
        }
        if !resp.status().is_success() {
            return Err(SyncError::Server(format!(
                "Server returned {}",
                resp.status()
            )));
        }
        Ok(true)
    }

    /// Fetch all data from cloud (initial sync).
    pub async fn fetch_full(&self) -> Result<SyncPayload, SyncError> {
        let resp = self
            .client
            .get(format!("{}/sync/full", self.base_url))
            .bearer_auth(&self.token)
            .send()
            .await?;

        if resp.status().as_u16() == 401 {
            return Err(SyncError::Auth("Invalid token".into()));
        }
        if !resp.status().is_success() {
            return Err(SyncError::Server(format!(
                "Server returned {}",
                resp.status()
            )));
        }

        let payload: SyncPayload = resp.json().await?;
        Ok(payload)
    }

    /// Fetch changes since a given timestamp.
    pub async fn fetch_changes(
        &self,
        since: &str,
        device_id: &str,
    ) -> Result<SyncPayload, SyncError> {
        let resp = self
            .client
            .get(format!("{}/sync/changes", self.base_url))
            .bearer_auth(&self.token)
            .query(&[("since", since), ("deviceId", device_id)])
            .send()
            .await?;

        if resp.status().as_u16() == 401 {
            return Err(SyncError::Auth("Invalid token".into()));
        }
        if !resp.status().is_success() {
            return Err(SyncError::Server(format!(
                "Server returned {}",
                resp.status()
            )));
        }

        let payload: SyncPayload = resp.json().await?;
        Ok(payload)
    }

    /// Push local changes to cloud.
    pub async fn push_changes(
        &self,
        payload: &SyncPayload,
    ) -> Result<PushResponse, SyncError> {
        let resp = self
            .client
            .post(format!("{}/sync/push", self.base_url))
            .bearer_auth(&self.token)
            .json(payload)
            .send()
            .await?;

        if resp.status().as_u16() == 401 {
            return Err(SyncError::Auth("Invalid token".into()));
        }
        if !resp.status().is_success() {
            return Err(SyncError::Server(format!(
                "Server returned {}",
                resp.status()
            )));
        }

        let push_resp: PushResponse = resp.json().await?;
        Ok(push_resp)
    }
}
