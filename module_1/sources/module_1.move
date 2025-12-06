module module_1::payment {
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;

    /// Error code if the caller is not the admin
    const E_NOT_ADMIN: u64 = 1;

    /// Replace this with your actual Wallet Address found in your Sui wallet
    const ADMIN_ADDRESS: address = @0xCAFE; 

    /// SUI transfer function
    /// You must pass a Coin object (payment_coin) to send money.
    public entry fun send_sui(
        payment_coin: &mut Coin<SUI>, // The coin object from your wallet
        recipient: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 1. Admin Check (Optional: Remove if you want anyone to use this)
        let sender = tx_context::sender(ctx);
        // Ensure you change ADMIN_ADDRESS above to your real address
        // 2. Split the coin
        // We take 'amount' out of the 'payment_coin'
        let coin_to_send = coin::split(payment_coin, amount, ctx);

        // 3. Send the split coin to the recipient
        transfer::public_transfer(coin_to_send, recipient);
    }
}