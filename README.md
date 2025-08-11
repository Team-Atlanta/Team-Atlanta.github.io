# Installation

## Install Hugo and Go

### Using Homebrew (macOS/Linux)

The easiest way to install Hugo and Go is using Homebrew:

```sh
# Install Hugo (extended version) and Go
brew install hugo go
```

Note: Homebrew will install the latest version of Hugo extended. This project requires Hugo v0.148.2 or later (extended version).

### Manual Installation

Alternatively, you can download the `hugo_extended` binary from [here](https://github.com/gohugoio/hugo/releases/tag/v0.148.2)
- e.g., macOS: [hugo_extended_0.148.2_darwin-universal.tar.gz](https://github.com/gohugoio/hugo/releases/download/v0.148.2/hugo_extended_0.148.2_darwin-universal.tar.gz)
- e.g., Linux: [hugo_extended_0.148.2_linux-amd64.tar.gz](https://github.com/gohugoio/hugo/releases/download/v0.148.2/hugo_extended_0.148.2_linux-amd64.tar.gz)

## Setup and Run 

```sh
# Check if hugo is properly installed
$ hugo version
hugo v0.148.2+extended+withdeploy darwin/arm64 BuildDate=2025-07-27T12:43:24Z VendorInfo=brew

# Install dependencies
$ npm install

# Run a development server: http://localhost:1313/
$ npm run dev

# Build and prepare docs/ for release
$ ./publish.sh

# Add docs/ and publish
$ git add docs
$ git commit -a -m "release: note"
$ git push

# It takes a few seconds to be updated
$ open https://team-atlanta.github.io/
```
