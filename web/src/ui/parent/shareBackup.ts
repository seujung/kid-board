export type ShareResult = "shared" | "downloaded" | "cancelled";

/** 공유 시트를 닫으면 Safari가 이 이름의 오류로 거부합니다. */
function isAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

/**
 * 백업 파일을 공유 시트로 보냅니다(웹 설계 6.5.3).
 * 파일 공유를 지원하면 `nav.share`를 부르고, 아니면 `<a download>`로 내려받습니다.
 * 부모가 공유 시트를 닫으면 "cancelled"입니다. 그 밖의 공유 오류는 그대로 던집니다.
 * 사용자 동작 안에서 `share`를 불러야 하므로, 이 함수를 부르기 전에 기다리지 마십시오.
 */
export async function shareBackup(
  file: { fileName: string; json: string },
  nav: Navigator,
  doc: Document,
): Promise<ShareResult> {
  const blob = new Blob([file.json], { type: "application/json" });
  const shareFile = new File([blob], file.fileName, { type: "application/json" });
  const data: ShareData = { files: [shareFile] };
  if (typeof nav.canShare === "function" && typeof nav.share === "function" && nav.canShare(data)) {
    try {
      await nav.share(data);
      return "shared";
    } catch (err) {
      if (isAbort(err)) return "cancelled";
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = file.fileName;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // 내려받기가 시작될 때까지 주소를 남겨 둡니다.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
