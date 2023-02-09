import { IEvent } from "@/interfaces"

export default interface ITx {
    code: number,
    data: Uint8Array,
    log: string,
    info: string,
    gasWanted: number,
    gasUsed: number,
    events: IEvent,
    codespace: string
}
