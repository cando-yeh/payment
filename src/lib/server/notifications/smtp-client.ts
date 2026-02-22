type SendMailParams = {
    host: string;
    port?: number;
    secure?: boolean;
    username?: string;
    password?: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    text: string;
    html: string;
    timeoutMs?: number;
};

export async function sendMailSmtp({
    host,
    port = 465,
    secure = true,
    username,
    password,
    from,
    to = [],
    cc = [],
    subject,
    text,
    html,
    timeoutMs = 15000,
}: SendMailParams) {
    const recipients = [...to, ...cc].filter(Boolean);
    if (recipients.length === 0) throw new Error("No recipients");

    let nodemailer: any;
    try {
        const mod = await import("nodemailer");
        nodemailer = mod.default ?? mod;
    } catch {
        throw new Error(
            'Missing dependency "nodemailer". Please run: npm install nodemailer',
        );
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth:
            username && password
                ? {
                      user: username,
                      pass: password,
                  }
                : undefined,
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs,
    });

    await transporter.sendMail({
        from,
        to,
        cc,
        subject,
        text: text || "",
        html: html || "",
    });
}
