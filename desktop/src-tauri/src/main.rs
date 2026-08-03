// Velora ERP — Tauri Desktop Backend
//
// This is the Rust backend for the Tauri desktop app.
// It provides native capabilities:
// - System tray
// - File system access (for exports, backups)
// - Native printing
// - Native notifications
// - Auto-update (future)
// - Window management

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// ─── Native Notification ────────────────────────────────────────────

#[tauri::command]
fn send_notification(title: String, body: String) -> Result<(), String> {
    // Tauri notification plugin would go here
    // For now, this is a placeholder for the architecture
    println!("[tauri] Notification: {} - {}", title, body);
    Ok(())
}

// ─── Native Printing ────────────────────────────────────────────────

#[tauri::command]
fn print_document(html: String) -> Result<(), String> {
    // Tauri print plugin would go here
    // For now, this is a placeholder
    println!("[tauri] Print request received ({} bytes of HTML)", html.len());
    Ok(())
}

// ─── File System Operations ─────────────────────────────────────────

#[tauri::command]
fn save_file_dialog(title: String, filters: Vec<String>) -> Result<Option<String>, String> {
    // File save dialog for exports (PDF, CSV, Excel)
    println!("[tauri] Save file dialog: {}", title);
    Ok(None)
}

#[tauri::command]
fn open_file_dialog(title: String, filters: Vec<String>) -> Result<Option<String>, String> {
    // File open dialog for imports
    println!("[tauri] Open file dialog: {}", title);
    Ok(None)
}

// ─── App Info ───────────────────────────────────────────────────────

#[tauri::command]
fn get_app_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "name": "Velora ERP",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}

// ─── Main ───────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            send_notification,
            print_document,
            save_file_dialog,
            open_file_dialog,
            get_app_info,
        ])
        .setup(|app| {
            // Get the main window
            let _window = app.get_webview_window("main")
                .expect("failed to get main window");
            println!("[tauri] Velora ERP desktop app initialized");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Velora ERP");
}
