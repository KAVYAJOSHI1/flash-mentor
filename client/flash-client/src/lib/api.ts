export async function getFlashReply(message: string): Promise<string> {
  try {
    const response = await fetch("http://localhost:5000/api/flash", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    return data.reply || "No reply from Flash";
  } catch (err) {
    console.error("⚠️ Flash API Error:", err);
    return "Failed to connect to Flash.";
  }
}
