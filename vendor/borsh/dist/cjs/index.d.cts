type IntegerType = "u8" | "u16" | "u32" | "u64" | "u128";
type StringType = "string";
type OptionType = {
    option: Schema;
};
type ArrayType = {
    array: {
        type: Schema;
        len?: number;
    };
};
type EnumType = {
    enum: Array<StructType>;
};
type StructType = {
    struct: {
        [key: string]: Schema;
    };
};
type Schema = IntegerType | StringType | OptionType | ArrayType | EnumType | StructType;
declare function serialize(schema: Schema, value: unknown): Uint8Array;
declare function deserialize(schema: Schema, buffer: Uint8Array): any;

export { type ArrayType, type EnumType, type IntegerType, type OptionType, type Schema, type StringType, type StructType, deserialize, serialize };
