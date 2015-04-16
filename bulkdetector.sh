#!/usr/bin/env bash
split -l 50 $1 dlist.
for listf in dlist.* ; do
    cat ${listf} | ./facefinder facefinder.yaml
done
