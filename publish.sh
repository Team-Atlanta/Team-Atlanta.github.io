#!/usr/bin/env bash

set -ex

npm run build
rm -rf docs
cp -rf public docs

git diff docs/

cat <<EOF
!
! If you are happy with docs/, do:
!

$ git add docs
$ git commit -a -m "release: $(date)"
$ git push
EOF
