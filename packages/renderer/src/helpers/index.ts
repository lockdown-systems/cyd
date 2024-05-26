export function getApiInfo(): ApiInfo {
    // This function checks to see if there's a userEmail and token, and if so if the token is valid
    // It returns {"userEmail": "email", "something@example.com": "token", "valid": true} if the token is valid
    // It returns {"userEmail": "email", "something@example.com": "", "valid": false} if the token is invalid
    // The email could still be there, even if the token is invalid
    let apiInfo: ApiInfo = {
        "userEmail": "",
        "token": "",
        "valid": false
    };

    (window as any).api.getConfig("userEmail").then((userEmail: string) => {
        if (userEmail) {
            apiInfo["userEmail"] = userEmail;

            // See if the user is authenticated
            (window as any).api.getConfig("token").then((token: string) => {
                if (token) {
                    apiInfo["token"] = token;

                    // See if the token is still valid
                    fetch("https://api.example.com/api/v1/ping", {}).then((response) => {
                        if (response.ok) {
                            apiInfo["valid"] = true;
                        }
                    });
                }
            });
        }
    });

    return apiInfo;
}