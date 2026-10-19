import { Text } from "react-native";
import { rgba } from "./glass";

const PALETTE = ["#5b8def", "#3fb68b", "#d9a441", "#b05f9a", "#d96b7b"];

// Short name for a mailbox: user@acme.com becomes "acme", user@example.co.jp becomes "example".
export const accountLabel = (account: string) => account.split("@")[1]?.split(".")[0] ?? account;

const accountColor = (account: string) => {
  let hash = 0;
  for (const ch of account) hash = (hash * 31 + ch.charCodeAt(0)) % PALETTE.length;
  return PALETTE[hash];
};

// Small pill that tells which mailbox an event or mail belongs to. Hidden when the account is unknown.
export function AccountTag({ account }: { account?: string }) {
  if (!account) return null;
  const color = accountColor(account);
  return (
    <Text
      style={{
        color,
        fontSize: 10,
        fontWeight: "700",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: rgba(color, 0.5),
        backgroundColor: rgba(color, 0.14),
        paddingHorizontal: 5,
        paddingVertical: 1,
        overflow: "hidden",
      }}
    >
      {accountLabel(account)}
    </Text>
  );
}
