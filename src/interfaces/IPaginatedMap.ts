export default interface IPaginatedMap<T> {
  data: T
  nextPage?: Uint8Array
}
