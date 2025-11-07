import type { XAccountController } from "../../x_account_controller";

export async function indexIsThereMore(
  controller: XAccountController,
): Promise<boolean> {
  return controller.thereIsMore;
}
