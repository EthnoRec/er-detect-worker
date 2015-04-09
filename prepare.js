#!/usr/bin/env node

var argv = require("yargs")
    .example("$0 --id=24 --out=./gather-images", "")
    .demand("id")
    .describe("id", "Job ID")

    .nargs("out", 1)
    .default("out","./gather-images")
    .describe("out", "Image directory output")

    .argv;

var DetectionJob = require("tinder-gather/app/models").DetectionJob;

var Promise = require("bluebird");
var request = Promise.promisify(require("request"));
var fs = Promise.promisifyAll(require("fs"));
var path = require("path");

var downloadPics = function(id,out){
    require("tinder-gather/app/config").gather.image_dir = out;
    return fs.mkdirAsync(out)
        .error(function(e){

        }).finally(function(){
            return DetectionJob.find({where:{_id:id}})
                .then(function(dj){
                   return dj.getImages(); 
                })
                .each(function(image){
                    return fs.accessAsync(path.join(out,image._id+"."+image.ext),fs.R_OK)
                        .catch(function(e){
                            return Promise.resolve(image.download());
                        });
                });
        });
};

var detectFaces = function(id) {
    // for each image
    //      ./facefinder ...
    // update job status
    return Promise.resolve(null);
};


downloadPics(argv.id,argv.out)
    .then(detectFaces(argv.id))
    .then(function(){
        process.exit(0);
})
