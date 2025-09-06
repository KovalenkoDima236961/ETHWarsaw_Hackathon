export type VerifyResult = {
    is_verified: boolean,
    fields: {
        "Certificate ID": string;
        "Instructor": string;
        "Course Name": string;
        "User Name & Surname": string;
        [key: string]: any;
    };
    pdf_ipfs_url: string;
    certdata_ipfs_url: string;
    merkle_root: string;
};