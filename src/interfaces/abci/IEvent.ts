export default interface IEvent {
    type: string,
    attributes: {
        key: Uint8Array,
        value: Uint8Array,
        index: boolean
    }
}