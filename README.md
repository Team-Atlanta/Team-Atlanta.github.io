# Installation

- Download the `hugo_extended` binary from [here](https://github.com/gohugoio/hugo/releases/tag/v0.121.2)
    - e.g., macos: [hugo_extended_0.121.2_darwin-universal.tar.gz](https://github.com/gohugoio/hugo/releases/download/v0.121.2/hugo_extended_0.121.2_darwin-universal.tar.gz)
    - e.g., linux: [hugo_extended_0.121.2_Linux-64bit.tar.gz](https://github.com/gohugoio/hugo/releases/download/v0.121.2/hugo_extended_0.121.2_Linux-64bit.tar.gz) 

```sh
; check if hugo is properly installed
$ hugo version
hugo v0.121.2-6d5b44305eaa9d0a157946492a6f319da38de154+extended darwin/amd64 BuildDate=2024-01-05T12:21:15Z VendorInfo=gohugoio

; install dependencies
$ npm install

; run a server: http://localhost:1313/
$ npm run dev

; build and prepare docs/ for release
$ ./publish.sh

; add docs/ and publish
$ git add docs
$ git commit -a -m "release: note"
$ git push

; it takes a few second to be updated
$ open https://team-atlanta.github.io/
```
