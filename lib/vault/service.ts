import { getSuiClient } from "@/lib/sui/client";
import { PACKAGE_ID, MODULE_NAME } from "@/lib/constants";
import type { VaultData, AgentCapData, OwnerCapData, Policy } from "./types";

const VAULT_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::Vault`;
const AGENT_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::AgentCap`;
const OWNER_CAP_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::OwnerCap`;

// -- Field extraction helpers --

function extractFields(content: unknown): Record<string, unknown> {
  const c = content as {
    dataType: string;
    fields?: Record<string, unknown> | { fields: Record<string, unknown> };
  };
  if (c.dataType !== "moveObject") {
    throw new Error("Expected moveObject content");
  }
  const raw = c.fields;
  if (!raw) throw new Error("Missing fields in moveObject");
  // SuiParsedData.fields can be { fields: {...}, type: string } or { [key]: MoveValue }
  if ("fields" in raw && typeof raw.fields === "object" && raw.fields !== null) {
    return raw.fields as Record<string, unknown>;
  }
  return raw as Record<string, unknown>;
}

function parsePolicy(policyFields: Record<string, unknown>): Policy {
  // policy.fields contains the nested struct fields
  const inner =
    "fields" in policyFields &&
    typeof policyFields.fields === "object" &&
    policyFields.fields !== null
      ? (policyFields.fields as Record<string, unknown>)
      : policyFields;

  return {
    maxBudget: BigInt(inner.max_budget as string),
    maxPerTx: BigInt(inner.max_per_tx as string),
    allowedActions: (inner.allowed_actions as number[]) ?? [],
    cooldownMs: Number(inner.cooldown_ms as string),
    expiresAt: Number(inner.expires_at as string),
  };
}

function parseVaultData(objectId: string, fields: Record<string, unknown>): VaultData {
  const balanceField = fields.balance_sui as Record<string, unknown>;
  const balanceValue =
    "fields" in balanceField &&
    typeof balanceField.fields === "object" &&
    balanceField.fields !== null
      ? (balanceField.fields as Record<string, unknown>).value
      : balanceField.value;

  return {
    id: objectId,
    owner: fields.owner as string,
    balance: BigInt(balanceValue as string),
    policy: parsePolicy(fields.policy as Record<string, unknown>),
    authorizedCaps: (fields.authorized_caps as string[]) ?? [],
    totalSpent: BigInt(fields.total_spent as string),
    lastTxTime: Number(fields.last_tx_time as string),
    txCount: Number(fields.tx_count as string),
  };
}

// -- Public API --

/**
 * Fetch a Vault object by ID from chain.
 */
export async function getVault(vaultId: string): Promise<VaultData> {
  const client = getSuiClient();
  const response = await client.getObject({
    id: vaultId,
    options: { showContent: true, showOwner: true },
  });

  if (!response.data?.content) {
    throw new Error(`Vault not found: ${vaultId}`);
  }

  const fields = extractFields(response.data.content);
  return parseVaultData(vaultId, fields);
}

/**
 * Fetch all OwnerCap objects owned by an address.
 */
export async function getOwnerCaps(ownerAddress: string): Promise<OwnerCapData[]> {
  const client = getSuiClient();
  const caps: OwnerCapData[] = [];
  let cursor: string | null | undefined = undefined;
  let hasNext = true;

  while (hasNext) {
    const page = await client.getOwnedObjects({
      owner: ownerAddress,
      filter: { StructType: OWNER_CAP_TYPE },
      options: { showContent: true },
      cursor,
    });

    for (const item of page.data) {
      if (!item.data?.content) continue;
      const fields = extractFields(item.data.content);
      const vaultId =
        typeof fields.vault_id === "string"
          ? fields.vault_id
          : (fields.vault_id as Record<string, unknown>)?.id ??
            String(fields.vault_id);

      caps.push({
        id: item.data.objectId,
        vaultId: vaultId as string,
      });
    }

    cursor = page.nextCursor;
    hasNext = page.hasNextPage;
  }

  return caps;
}

/**
 * Fetch all AgentCap objects owned by an address.
 */
export async function getAgentCaps(agentAddress: string): Promise<AgentCapData[]> {
  const client = getSuiClient();
  const caps: AgentCapData[] = [];
  let cursor: string | null | undefined = undefined;
  let hasNext = true;

  while (hasNext) {
    const page = await client.getOwnedObjects({
      owner: agentAddress,
      filter: { StructType: AGENT_CAP_TYPE },
      options: { showContent: true },
      cursor,
    });

    for (const item of page.data) {
      if (!item.data?.content) continue;
      const fields = extractFields(item.data.content);
      const vaultId =
        typeof fields.vault_id === "string"
          ? fields.vault_id
          : (fields.vault_id as Record<string, unknown>)?.id ??
            String(fields.vault_id);

      caps.push({
        id: item.data.objectId,
        vaultId: vaultId as string,
      });
    }

    cursor = page.nextCursor;
    hasNext = page.hasNextPage;
  }

  return caps;
}

/**
 * Fetch all Vaults that an owner controls (via OwnerCaps).
 */
export async function getOwnedVaults(ownerAddress: string): Promise<VaultData[]> {
  const ownerCaps = await getOwnerCaps(ownerAddress);

  if (ownerCaps.length === 0) return [];

  const vaultIds = ownerCaps.map((cap) => cap.vaultId);

  const client = getSuiClient();
  const responses = await client.multiGetObjects({
    ids: vaultIds,
    options: { showContent: true, showOwner: true },
  });

  const vaults: VaultData[] = [];
  for (const response of responses) {
    if (!response.data?.content) continue;
    const fields = extractFields(response.data.content);
    vaults.push(parseVaultData(response.data.objectId, fields));
  }

  return vaults;
}

/**
 * Check if an AgentCap is still authorized on its Vault.
 */
export async function isAgentCapAuthorized(
  agentCapId: string,
  vaultId: string,
): Promise<boolean> {
  const vault = await getVault(vaultId);
  return vault.authorizedCaps.includes(agentCapId);
}

/**
 * Get remaining budget for a vault (max_budget - total_spent).
 */
export async function getRemainingBudget(vaultId: string): Promise<bigint> {
  const vault = await getVault(vaultId);
  return vault.policy.maxBudget - vault.totalSpent;
}
