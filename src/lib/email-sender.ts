import { ses } from "tencentcloud-sdk-nodejs-ses";

import type { AuthOutboundEmail } from "./user-auth";

export type AuthEmailMessage = AuthOutboundEmail;

function actionUrl(baseUrl: string, message: AuthEmailMessage) {
  if (message.purpose === "registration_notice") return "";
  const path = message.purpose === "verify_email" ? "/verify-email" : "/reset-password";
  return `${baseUrl}${path}?token=${encodeURIComponent(message.token)}`;
}

export function createDevelopmentEmailSender(input: {
  log?: (message: string) => void;
  baseUrl: string;
}) {
  const messages: AuthEmailMessage[] = [];
  const send = async (message: AuthEmailMessage) => {
    messages.push({ ...message });
    input.log?.(`[auth-email] queued ${message.purpose} email for ${message.email}`);
  };
  send.peekForTests = () => messages.map((message) => ({ ...message }));
  return send;
}

export function selectAuthEmailSender(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV === "production" && environment.AUTH_EMAIL_MODE !== "tencent-ses") {
    throw new Error("AUTH_EMAIL_MODE must be tencent-ses in production");
  }
  if (environment.NODE_ENV === "production") {
    let baseUrl: URL;
    try { baseUrl = new URL(environment.APP_BASE_URL ?? ""); }
    catch { throw new Error("APP_BASE_URL must be a valid HTTPS URL in production"); }
    if (baseUrl.protocol !== "https:") throw new Error("APP_BASE_URL must use HTTPS in production");
  }
  return environment.AUTH_EMAIL_MODE === "tencent-ses"
    ? createTencentSesSender(environment)
    : createDevelopmentEmailSender({ baseUrl: environment.APP_BASE_URL ?? "http://localhost:3100", log: console.info });
}

export function createTencentSesSender(environment: NodeJS.ProcessEnv = process.env) {
  const required = ["TENCENTCLOUD_SECRET_ID", "TENCENTCLOUD_SECRET_KEY", "TENCENT_SES_REGION", "TENCENT_SES_FROM_EMAIL", "TENCENT_SES_TEMPLATE_ID", "APP_BASE_URL"] as const;
  for (const key of required) if (!environment[key]) throw new Error(`${key} is required for Tencent SES`);
  const client = new ses.v20201002.Client({
    credential: { secretId: environment.TENCENTCLOUD_SECRET_ID!, secretKey: environment.TENCENTCLOUD_SECRET_KEY! },
    region: environment.TENCENT_SES_REGION!,
    profile: { httpProfile: { endpoint: "ses.tencentcloudapi.com" } },
  });
  return async (message: AuthEmailMessage) => {
    const url = actionUrl(environment.APP_BASE_URL!, message);
    await client.SendEmail({
      FromEmailAddress: environment.TENCENT_SES_FROM_EMAIL!,
      Destination: [message.email],
      Subject: message.purpose === "verify_email"
        ? "验证多糖科研数据库邮箱"
        : message.purpose === "reset_password"
          ? "重置多糖科研数据库密码"
          : "多糖科研数据库注册提醒",
      Template: {
        TemplateID: Number(environment.TENCENT_SES_TEMPLATE_ID),
        TemplateData: JSON.stringify({
          action_url: url,
          purpose: message.purpose,
          message: message.purpose === "registration_notice"
            ? "有人尝试使用该邮箱注册多糖科研数据库账号，如非本人操作可忽略此邮件。"
            : "",
        }),
      },
    });
  };
}
