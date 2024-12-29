import { BaseArkProvider } from "./base";
import type { VirtualCoin } from "../types/wallet";

export class ArkProvider extends BaseArkProvider {
    async getInfo() {
        const url = `${this.serverUrl}/v1/info`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to get server info: ${response.statusText}`
            );
        }
        return response.json();
    }

    async getVirtualCoins(address: string): Promise<VirtualCoin[]> {
        const url = `${this.serverUrl}/v1/vtxos/${address}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch VTXOs: ${response.statusText}`);
        }
        const data = await response.json();

        // Convert from server format to our internal VTXO format
        return [...(data.spendableVtxos || []), ...(data.spentVtxos || [])].map(
            (vtxo) => ({
                txid: vtxo.outpoint.txid,
                vout: vtxo.outpoint.vout,
                value: Number(vtxo.amount),
                status: {
                    confirmed: !!vtxo.roundTxid,
                },
                virtualStatus: {
                    state: vtxo.spent
                        ? "spent"
                        : vtxo.swept
                          ? "swept"
                          : vtxo.isPending
                            ? "pending"
                            : "settled",
                    batchTxID: vtxo.roundTxid,
                    batchExpiry: vtxo.expireAt
                        ? Number(vtxo.expireAt)
                        : undefined,
                },
            })
        );
    }

    async submitVirtualTx(psbtBase64: string): Promise<string> {
        const url = `${this.serverUrl}/v1/redeem-tx`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                redeem_tx: psbtBase64,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const grpcError = JSON.parse(errorText);
                // gRPC errors usually have a message and code field
                throw new Error(
                    `Failed to submit virtual transaction: ${grpcError.message || grpcError.error || errorText}`
                );
            } catch (_e) {
                // If JSON parse fails, use the raw error text
                throw new Error(
                    `Failed to submit virtual transaction: ${errorText}`
                );
            }
        }

        const data = await response.json();
        return data.txid;
    }

    async subscribeToEvents(
        callback: (event: any) => void
    ): Promise<() => void> {
        const url = `${this.serverUrl}/v1/events`;
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            callback(data);
        };

        eventSource.onerror = () => {
            // Error handling is done by the callback
        };

        // Return unsubscribe function
        return () => eventSource.close();
    }
}
