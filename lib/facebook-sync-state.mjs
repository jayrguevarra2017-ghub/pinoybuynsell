export const facebookSyncInProgress = "Facebook update in progress.";

export function editableFacebookPost(record, pageId) {
  if(!/^\d+$/.test(pageId || "")) return false;
  return record?.status === "published" && record.page_id === pageId
    && new RegExp(`^${pageId}_\\d+$`).test(record.post_id || "");
}

export function facebookSyncBusy(record, now=Date.now()) {
  return record?.message === facebookSyncInProgress && now-Date.parse(record.updated_at)<120000;
}
