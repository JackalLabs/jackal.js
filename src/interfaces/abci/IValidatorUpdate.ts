export default interface IValidatorUpdate {
    pubKey: {
        ed25519?: Uint8Array | undefined,
        secp256k1?: Uint8Array | undefined
    },
    power: number
}