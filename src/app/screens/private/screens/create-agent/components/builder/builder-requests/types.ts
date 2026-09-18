import { z } from 'zod';

export type BuilderRequestKind = 'data-store-credentials';

export interface BuilderRequest {
    id: string;
    kind: BuilderRequestKind;
    dataStoreId?: string;
}

// Goes back to the model, so there is deliberately no slot for a field value.
export const builderRequestReceiptSchema = z.object({
    status: z.enum(['completed', 'cancelled']),
    summary: z.string(),
    // Set when the surface cannot help at all, so retrying the card is pointless.
    blocked: z.boolean().optional(),
    dataStoreId: z.string().optional(),
});

export type BuilderRequestReceipt = z.infer<typeof builderRequestReceiptSchema>;

export const cancelledReceipt = (summary: string): BuilderRequestReceipt => ({ status: 'cancelled', summary });
