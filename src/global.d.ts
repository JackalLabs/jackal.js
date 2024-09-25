////// -----------------------------------------------------------------------------------------------------------------
/*//// -----------------------------------------------------------------------------------------------------------------

This file is an "Ambient declarations file". The types defined here are available globally.
More info here: https://stackoverflow.com/a/73389225/985454

Don't use `import` and `export` in this file directly! It breaks ambience.
To import external types in an ambient declarations file (this file) use the following:

*/ /**
 * @example
 * declare type React = import('react')
 */ /*

To contribute ambient declarations from any file, even non-ambient ones, use this:

*/ /**
 * @example
 * declare global {
 *   interface Window {
 *     AJS: any
 *   }
 * }
 */ /*

/*/ /// -----------------------------------------------------------------------------------------------------------------
////// -----------------------------------------------------------------------------------------------------------------

type AnyObject<T = any> = Record<string, T>
type AnyFunction = (...args: any[]) => any
type AnyAsyncFunction = (...args: any[]) => Promise<any>

type AllowArray<T> = T | T[]

type ValuesOf<T> = T[keyof T]

/* Strings */

type Stringish = string | number | boolean | null | undefined

type Length<S extends string> = Split<S>['length']

/**
 * Joins array of const strings into a single const string that retains its const type value.
 * @see `holograph/src/utils/index@join()`
 *
 * Note, it is necessary to convert the **readonly** const strings to Writeable for this to work.
 * @example
 * Join<Writeable<S>, Sep>
 * Join<["a", "b"], " "> // "a b"
 */
type Join<
  S extends Stringish[],
  Sep extends string = '',
> = Tail<S>['length'] extends 0
  ? `${S[0]}`
  : `${S[0]}${Sep}${Join<Tail<S>, Sep>}`

/** Splits a string into an array of substrings. */
type Split<
  S extends string,
  Sep extends string = '',
> = S extends `${infer U}${Sep}${infer V}`
  ? [U, ...Split<V, Sep>]
  : S extends ''
    ? []
    : [S]

/* Tuples */

/** Changes type of tuple members. */
type ReTuple<T extends any[], NewType = any> = { [K in keyof T]: NewType }
/** Makes tuple members optional. */
type OptionalTuple<T extends any[]> = { [K in keyof T]: T[K] | undefined }
/** Creates a tuple of set length and type. */
type ExactTuple<
  T,
  Length extends number,
  /** don't */ __A extends any[] = [],
> = __A extends {
    length: Length
  }
  ? __A
  : ExactTuple<T, Length, [...__A, T]>
/** Removes first item from a tuple and returns the rest. */
type Tail<T> = T extends [infer _FirstItem, ...infer Rest] ? Rest : never

/**
 * This type allows to add JSDoc annotation to any type without causing conflicts.
 *
 * @example
 * type IconButtonProps =
 *  & JSDoc
 *  & ShorthandVariantsAndSizes
 *
 * type JSDoc = Documentation<ShorthandVariantsAndSizes, {
 *  /★★
 *   * **variant**: Color theme for the button.
 *   * - `light` variant is white on all themes.
 *   ★/
 *   variant?: unknown  // <- note: this `?: unknown` optional type is important
 *   // ... other props
 * }>
 */
type Documentation<
  T,
  TargetType extends { [K in keyof T]?: unknown },
> = TargetType

// ---------------------------------------------------------------------------------------------------------------------

/**
 * **All** properties or **none** must be provided.
 */
type AllOrNone<T> = T | { [K in keyof T]?: never }

/**
 * Requires **at least one** property to be provided.
 */
type AtLeastOne<T, Keys extends keyof T = keyof T> = Normalize<
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
    Partial<Record<Exclude<Keys, K>, T[K]>>
  }[Keys]
>

/**
 * Requires **only one** property to be provided.
 */
type OnlyOne<T, Keys extends keyof T = keyof T> = Normalize<
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
    Partial<Record<Exclude<Keys, K>, never>>
  }[Keys]
>

/**
 * Allows **only one** property to be provided or none.
 */
type OnlyOneOrNone<T, Keys extends keyof T = keyof T> = Normalize<
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]?: Pick<T, K> & Partial<Record<Exclude<Keys, K>, never>>
  }[Keys]
>

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Enhanced version of `Pick<T, keyof T>` that allows to pick and **rename** properties.
 * https://stackoverflow.com/a/75963430/985454
 *
 * @example
 * PickAs<{ a: 1, b: 2, c: 3 }, 'a:x' | 'b:y' | 'c'> // { x: 1, y: 2, c: 3}
 */
type PickAs<
  T,
  K extends | `${string}:${string}`
    | Exclude<keyof T, K extends `${infer A}:${string}` ? A : never>,
> = ShallowNormalize<
  UnionToIntersection<
    K extends `${infer A}:${infer B}` ? { [key in B]: T[A] } : never
  > &
  Pick<T, Extract<K, keyof T>>
>
/*`*/

type Modify<T, R extends PartialAny<T>> = Omit<T, keyof R> & R

type ModifyDeep<A, B extends DeepPartialAny<A>> = {
  // https://stackoverflow.com/a/74216680/985454
  [K in keyof A | keyof B /**/]: K extends keyof A // For all keys in A and B: ... // ───┐
    ? /**/ K extends keyof B // ───n ─ y ? key K exists in both A and B ...
      ? /*  */ A[K] extends AnyObject //    │  ─┴──┐
        ? /*  */ B[K] extends AnyObject //    │  ─── n ─ y ? both A and B are objects ...
          ? /*    */ B[K] extends readonly any[] //    │      │   ┼── ? but if B is an array ...
            ? /*      */ B[K] //    │      │   │   └─ ... 🠆 use B as the final type (new type)
            : /*      */ ModifyDeep<A[K], B[K]> //    │      │   └─── ... 🠆 else We need to go deeper (recursively)
          : /*  */ B[K] //    │      ├─ ... B is a primitive 🠆 use B as the final type (new type)
        : /*  */ B[K] //    │      └─ ... A is a primitive 🠆 use B as the final type (new type)
      : /**/ A[K] //    ├─ ... key only exists in A 🠆 use A as the final type (original type)
    : /**/ B[K] //    └─ ... key only exists in B 🠆 use B as the final type (new type)
}

type ModifyDeep1<A, B extends DeepPartialAny<A>> = {
  // https://stackoverflow.com/a/74216680/985454
  [K in keyof A | keyof B /**/]: K extends keyof A // For all keys in A and B: ... // ───┐
    ? /* */ K extends keyof B // ── n ─ y ? key K exists in both A and B ...
      ? /*   */ A[K] extends AnyObject //    │  ─┴──┐
        ? /*     */ B[K] extends AnyObject //    │  ─── n ─ y ? both A and B are objects ...
          ? /*       */ ModifyDeep1<A[K], B[K]> //    │      │   └─ ... 🠆 We need to go deeper (recursively)
          : /*       */ B[K] //    │      ├─ ... B is a primitive 🠆 use B as the final type (new type)
        : /*     */ B[K] //    │      └─ ... A is a primitive 🠆 use B as the final type (new type)
      : /*   */ A[K] //    ├─ ... key only exists in A 🠆 use A as the final type (original type)
    : /* */ B[K] //    └─ ... key only exists in B 🠆 use B as the final type (new type)
}

/** Makes each property optional and turns each leaf property into any, allowing for type overrides by narrowing any. */
type DeepPartialAny<T> = {
  [P in keyof T]?: T[P] extends AnyObject ? DeepPartialAny<T[P]> : any
}

type PartialAny<T> = {
  [P in keyof T]?: any
}

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

/** Normalize type by recursively applying any type aliases and merging explicit intersections. */
type Normalize<T> = T extends (...args: infer A) => infer R
  ? (...args: Normalize<A>) => Normalize<R>
  : { [K in keyof T]: Normalize<T[K]> }

/** Merges intersection `{a} & {b}` into `{a, b}`. *(Similar to `Normalize` but simpler.)* */
type ShallowNormalize<T> = { [K in keyof T]: T[K] }

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
    k: infer I,
  ) => void
  ? I
  : never

/**
 * This type lights red when two types are not equal. Useful where you need to keep two objects / types in sync.
 *
 * @example
 * type A = ValuesOf<typeof CHAIN_IDS>
 * type B = keyof typeof CHAIN_NAMES
 * type C = keyof typeof SCAN_EXPLORER_LINKS
 * type check =
 *   & CheckIntegrity<A, B>
 *   & CheckIntegrity<B, A>
 *   // or shorter (optional)
 *   & CheckIntegrity<A, C, A>
 */
type CheckIntegrity<T, T2 extends T, T3 extends T2 = T> = never

// Window and library interfaces overrides -------------------------------------------------------------------------------------

interface Window {
  d: any // debug object, put anything here without TypeScript complaining about "Property 'd' does not exist on Window."
}
