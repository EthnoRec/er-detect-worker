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
var Image = require("tinder-gather/app/models").Image;

var Promise = require("bluebird");
var request = Promise.promisify(require("request"));
var fs = Promise.promisifyAll(require("fs"));
var path = require("path");
var spawn = require("child_process").spawn;
var spawn = require("child-process-promise").spawn;

var downloadPics = function(id,out){
    require("tinder-gather/app/config").gather.image_dir = out;
    return fs.mkdirAsync(out)
        .error(function(e){

        }).finally(function(){
            return DetectionJob.find({where:{_id:id}})
                .then(function(dj){
                   return dj.getUnprocessedImages(); 
                })
                .each(function(image){
                    return fs.accessAsync(path.join(out,image._id+"."+image.ext),fs.R_OK)
                        .catch(function(e){
                            return Promise.resolve(image.download());
                        });
                });
        });
};

var detectFaces = function(id,out) {
    return DetectionJob.find({_id:id}).then(function(dj){
        return dj.getUnprocessedImages()
    }).map(function(image){
        return image._id+"."+image.ext;
    }).then(function(list){
        return spawn("./facefinder",[out])
            .progress(function(cp){
                cp.stdout.on("data",function(data){
                    console.log("[facefinder] - "+data.toString().substr(0,data.length-1));
                });
                cp.stderr.on("data",function(data){
                    console.log("[facefinder] - (stderr) "+data.toString().substr(0,data.length-1));
                });
                cp.stdin.write(list.join("\n")+"\n");
                cp.stdin.end();
            })
            .fail(function(e){
                throw new Error(e);
            })
    });
};

var jobStatus = function(id,status){
    return DetectionJob.find({where:{_id:id}}).then(function(dj){
        dj.status = status;
        dj.save();
    });
};


downloadPics(argv.id,argv.out)
    .then(jobStatus(argv.id,"started"))
    .return(detectFaces(argv.id,argv.out))
    .then(jobStatus(argv.id,"finished"));
