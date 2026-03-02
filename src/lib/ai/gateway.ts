import { gateway as defaultGateway } from "@ai-sdk/gateway";

export const gateway = defaultGateway;

export function getModel(modelId: string) {
  return gateway(modelId);
}
