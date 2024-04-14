if (!(Test-Path "key")) {
    mkdir key
}
# Generate a private key 
openssl genrsa -out ./key/private.pem 2048

# Generate a public key 
openssl rsa -in ./key/private.pem -pubout -out ./key/public.pem

# Generate a certificate signing request (CSR) for the client
#openssl req -new -key ./key/private.pem -out ./key/client-csr.pem

# Sign the client CSR with your CA or for self-signed, sign it directly
#openssl x509 -req -days 365 -in ./key/client-csr.pem -signkey ./key/private.pem -out ./key/client-cert.pem