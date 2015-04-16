#!/usr/bin/env bash

split -l 50 list.tmp dlist.
for listf in dlist.* ; do
    cat ${listf} | ./facefinder facefinder.yaml
done
