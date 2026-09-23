"use client";

// Thin loader around Google's Picker JS API (apis.google.com/js/api.js).
// Requires NEXT_PUBLIC_GOOGLE_PICKER_API_KEY — a *public*, HTTP-referrer-
// restricted API key from Google Cloud Console (Credentials -> API Key,
// restricted to the Picker API + this app's domains), NOT the OAuth client
// secret. The OAuth access token itself comes from the backend's
// /connections/google/picker-token endpoint (see use-google-sheets-connection.ts)
// so the refresh token never reaches the browser.

declare global {
  interface Window {
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new (viewId?: unknown) => GoogleDocsView;
        ViewId: { SPREADSHEETS: unknown };
        Action: { PICKED: string };
      };
    };
  }
}

interface GoogleDocsView {
  setMimeTypes: (mimeTypes: string) => GoogleDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (appId: string) => GooglePickerBuilder;
  setCallback: (cb: (data: PickerResponse) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

export type PickerResponse = {
  action: string;
  docs?: { id: string; name: string }[];
};

let loadPromise: Promise<void> | null = null;

function loadGapiScript(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.gapi?.load) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google API script"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

async function ensurePickerLoaded(): Promise<void> {
  await loadGapiScript();
  await new Promise<void>((resolve) => window.gapi!.load("picker", () => resolve()));
}

export async function openGoogleSheetsPicker(
  accessToken: string,
  appId: string,
  onPicked: (file: { id: string; name: string }) => void
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_PICKER_API_KEY is not configured");
  }

  await ensurePickerLoaded();
  const google = window.google!;

  const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMimeTypes(
    "application/vnd.google-apps.spreadsheet"
  );

  const picker = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(accessToken)
    .setDeveloperKey(apiKey)
    .setAppId(appId)
    .setCallback((data: PickerResponse) => {
      if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
        onPicked({ id: data.docs[0].id, name: data.docs[0].name });
      }
    })
    .build();

  picker.setVisible(true);
}
