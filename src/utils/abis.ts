export const RootABI = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "_relays",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "_priceFeed",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addAllowance",
        "inputs": [
            {
                "name": "allow",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addEditors",
        "inputs": [
            {
                "name": "editor_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "editor_keys",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addEditorsFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "editor_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "editor_keys",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addRelay",
        "inputs": [
            {
                "name": "_relay",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addViewers",
        "inputs": [
            {
                "name": "viewer_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "viewer_keys",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addViewersFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "viewer_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "viewer_keys",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "allowances",
        "inputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "blockSenders",
        "inputs": [
            {
                "name": "to_block",
                "type": "string[]",
                "internalType": "string[]"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "blockSendersFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "to_block",
                "type": "string[]",
                "internalType": "string[]"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "buyStorage",
        "inputs": [
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "duration_days",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "size_bytes",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "referral",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "buyStorageFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "duration_days",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "size_bytes",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "referral",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "changeOwner",
        "inputs": [
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "new_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "changeOwnerFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "new_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "createNotification",
        "inputs": [
            {
                "name": "to",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "contents",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "private_contents",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "createNotificationFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "to",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "contents",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "private_contents",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deleteFile",
        "inputs": [
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "start",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deleteFileFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "start",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deleteFileTree",
        "inputs": [
            {
                "name": "hash_path",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "account",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deleteFileTreeFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "hash_path",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "account",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deleteNotification",
        "inputs": [
            {
                "name": "notification_from",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "time",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deleteNotificationFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "notification_from",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "time",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "distributeBalance",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getAllowance",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "to",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getPrice",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "int256",
                "internalType": "int256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getStoragePrice",
        "inputs": [
            {
                "name": "filesize",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "months",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "postFile",
        "inputs": [
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "filesize",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "note",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "expires",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "postFileFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "filesize",
                "type": "uint64",
                "internalType": "uint64"
            },
            {
                "name": "note",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "expires",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "postFileTree",
        "inputs": [
            {
                "name": "account",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "hash_parent",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "hash_child",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "contents",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "viewers",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "editors",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "tracking_number",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "postFileTreeFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "account",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "hash_parent",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "hash_child",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "contents",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "viewers",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "editors",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "tracking_number",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "postKey",
        "inputs": [
            {
                "name": "key",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "postKeyFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "key",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "provisionFileTree",
        "inputs": [
            {
                "name": "editors",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "viewers",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "tracking_number",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "provisionFileTreeFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "editors",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "viewers",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "tracking_number",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "relays",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "removeAllowance",
        "inputs": [
            {
                "name": "allow",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "removeEditors",
        "inputs": [
            {
                "name": "editor_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "removeEditorsFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "editor_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "removeRelay",
        "inputs": [
            {
                "name": "_relay",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "removeViewers",
        "inputs": [
            {
                "name": "viewer_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "removeViewersFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "viewer_ids",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "requestReportForm",
        "inputs": [
            {
                "name": "prover",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "owner",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "start",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "requestReportFormFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "prover",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "owner",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "start",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "resetEditors",
        "inputs": [
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "resetEditorsFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "resetViewers",
        "inputs": [
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "resetViewersFrom",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "AddedEditors",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "editor_ids",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "editor_keys",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "AddedViewers",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "viewer_ids",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "viewer_keys",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "BlockedSenders",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "to_block",
                "type": "string[]",
                "indexed": false,
                "internalType": "string[]"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "BoughtStorage",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "duration_days",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            },
            {
                "name": "size_bytes",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            },
            {
                "name": "referral",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ChangedOwner",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "new_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "CreatedNotification",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "to",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "contents",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "private_contents",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "DeletedFile",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "merkle",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "start",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "DeletedFileTree",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "hash_path",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "account",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "DeletedNotification",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "notification_from",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "time",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PostedFile",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "merkle",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "size",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            },
            {
                "name": "note",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "expires",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PostedFileTree",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "account",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "hash_parent",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "hash_child",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "contents",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "viewers",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "editors",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "tracking_number",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PostedKey",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "key",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ProvisionedFileTree",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "editors",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "viewers",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "tracking_number",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RemovedEditors",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "editor_ids",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RemovedViewers",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "viewer_ids",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RequestedReportForm",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "prover",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "merkle",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "start",
                "type": "uint64",
                "indexed": false,
                "internalType": "uint64"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ResetEditors",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ResetViewers",
        "inputs": [
            {
                "name": "from",
                "type": "address",
                "indexed": false,
                "internalType": "address"
            },
            {
                "name": "for_address",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "file_owner",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [
            {
                "name": "owner",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ]
    }
] as const

export const AppABI = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "_jackalAddress",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "cabinet",
        "inputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "fileAddress",
        "inputs": [
            {
                "name": "_addr",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_index",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "fileCount",
        "inputs": [
            {
                "name": "_addr",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "upload",
        "inputs": [
            {
                "name": "merkle",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "filesize",
                "type": "uint64",
                "internalType": "uint64"
            }
        ],
        "outputs": [],
        "stateMutability": "payable"
    }
] as const
