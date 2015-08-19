#!/usr/bin/env bash
./detect.js --id=${1} --plain > ./list.tmp
sed -e 's/^/gather-images\//' list.tmp > list_tar.tmp
tar cf job-${1}.tar list.tmp
tar rf job-${1}.tar -T list_tar.tmp

rm list_tar.tmp
