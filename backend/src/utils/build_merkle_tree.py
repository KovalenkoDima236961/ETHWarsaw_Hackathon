import hashlib

def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()

def merkle_tree_hash(leaves: list[bytes]) -> bytes:
    if not leaves:
        return b"\x00" * 32
    current = [sha256(leaf) for leaf in leaves]
    while len(current) > 1:
        if len(current) % 2 == 1:
            current.append(current[-1])
        current = [sha256(current[i] + current[i+1]) for i in range(0, len(current), 2)]
    return current[0]

def generate_merkle_root(data_dict: dict) -> str:
    leaf_hashes = [key.encode() + b":" + str(value).encode() for key, value in sorted(data_dict.items())]
    root = merkle_tree_hash(leaf_hashes)
    return root.hex()

def build_merkle_tree_and_proofs(leaves: list[bytes]) -> tuple[list[list[bytes]], list[bytes]]:
    if not leaves:
        return [], []
    hashes = [sha256(leaf) for leaf in leaves]
    tree_levels = [hashes]
    current = hashes
    while len(current) > 1:
        if len(current) % 2 == 1:
            current.append(current[-1])
        next_level = [sha256(current[i] + current[i+1]) for i in range(0, len(current), 2)]
        tree_levels.append(next_level)
        current = next_level
    return tree_levels, hashes

def get_merkle_proof(tree_levels: list[list[bytes]], index: int) -> list[str]:
    proof = []
    for level in tree_levels[:-1]:
        pair_index = index ^ 1
        if pair_index < len(level):
            proof.append(level[pair_index].hex())
        index = index // 2
    return proof

def build_merkle_proofs(full_data: dict, fields: list[str]) -> dict:
    items = sorted(full_data.items())
    leaves = [f"{k}: {v}".encode() for k, v in items]
    tree_levels, leaf_hashes = build_merkle_tree_and_proofs(leaves)
    leaf_index_map = {f"{k}: {v}": i for i, (k, v) in enumerate(items)}

    result = {}
    for field in fields:
        if field not in full_data:
            continue
        key_val = f"{field}: {full_data[field]}"
        idx = leaf_index_map[key_val]
        proof = get_merkle_proof(tree_levels, idx)
        result[field] = proof 
    return result