---
sidebar_position: 3
---

# For Testers

This page is intended for people who are running the dev version of Cyd to help test it.

:::info
The dev version of Cyd uses a dev server which limits what email addresses are allowed to sign up for Cyd accounts. While anyone can download the dev version, you can only sign up for a test Premium plan if you've spoken a member of the Lockdown Systems Collective and we have agreed to let you test.
:::

## Accessing Premium features while testing

Once you're signed into your dev Cyd account, you can sign up for Premium using the following test credit card:

- Card number: `4242 4242 4242 4242`
- Expiration date: anything in the future
- Security code: make it up
- Billing address: make it up

## Download Cyd Dev

### For Windows and Mac users

Here's where to download the latest development release of Cyd:

- macOS: https://dev-api.cyd.social/download?platform=macos
- Windows x64: https://dev-api.cyd.social/download?platform=windows
- Windows arm64: https://dev-api.cyd.social/download?platform=windows&arch=arm64

### For Linux users

Here are instructions for .deb repos:

```sh
# Import the signing key
curl -fsSL https://releases.lockdown.systems/signing-key.asc | sudo gpg --dearmor -o /usr/share/keyrings/lockdown-systems-archive-keyring.gpg

# Add the repository
echo "deb [signed-by=/usr/share/keyrings/lockdown-systems-archive-keyring.gpg] https://releases.lockdown.systems/debian/ dev main" | sudo tee /etc/apt/sources.list.d/lockdown-systems.list

# Install Cyd
sudo apt update
sudo apt install cyd
```

Here are instructions for .rpm repos:

```sh
# Import the signing key
sudo rpm --import https://releases.lockdown.systems/signing-key.asc

# Add the repository
sudo tee /etc/yum.repos.d/lockdown-systems.repo <<EOF
[lockdown-systems]
name=Lockdown Systems Repository
baseurl=https://releases.lockdown.systems/rpm/dev/
enabled=1
gpgcheck=1
gpgkey=https://releases.lockdown.systems/signing-key.asc
EOF

# Install Cyd
sudo dnf install cyd
```

If those don't work for you, you can download a zip file version here:

- Linux (zip) x64: https://dev-api.cyd.social/download?platform=linux
- Linux (zip) x64 PGP sig: https://dev-api.cyd.social/download?platform=linux&sig=true
- Linux (zip) arm64: https://dev-api.cyd.social/download?platform=linux&arch=arm64
- Linux (zip) arm64 PGP sig: https://dev-api.cyd.social/download?platform=linux&arch=arm64&sig=true
