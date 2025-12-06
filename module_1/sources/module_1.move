/*
/// Module: module_1
module module_1::module_1;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions


module {{sender}}::payment {

    use std::error;
    use std::option;
    use std::string;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    /// ADMIN belirle (senin adresin)
    const E_NOT_ADMIN: u64 = 1;

    /// SUI transfer eden fonksiyon
    public entry fun send_sui(
        recipient: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // Admin cüzdan kontrolü
        let sender = TxContext::sender(ctx);
        assert!(sender == @{{sender}}, E_NOT_ADMIN);

        // Move, SUI'yi otomatik olarak gas coin'den oluşturur
        let coin = coin::split(&coin::value<SUI>(ctx), amount);

        // Gönder
        coin::transfer(coin, recipient);
    }
}
