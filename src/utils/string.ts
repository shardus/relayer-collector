export const bigIntToHex = (num: bigint): string => {
  return '0x' + num.toString(16)
}
