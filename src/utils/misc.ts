export function orderStrings (sortable: string[]) {
  return sortable.sort((a: string, b: string) => {
    const lowerA = a.toLowerCase()
    const lowerB = b.toLowerCase()
    if (lowerA < lowerB) {
      return -1
    } else if (lowerA > lowerB) {
      return 1
    } else {
      return 0
    }
  })
}