#!/usr/bin/env node

var _ = require("underscore");

var argv = require("yargs")
    .example("$0 --id=24 --config=./facefinder.yaml", "")
    .demand("id")
    .describe("id", "Job ID")
    .option("c",{
        default: "./facefinder.yaml",
        describe: "facefinder configuration",
        alias: "config"
    })
    .option("plain",{
        default: false,
        describe: "Print the whole list of <image_id>.<ext>",
        type: "boolean"
    })
    .argv;

var DetectionJob = require("tinder-gather/app/models").DetectionJob;
var Image = require("tinder-gather/app/models").Image;

var Promise = require("bluebird");
var request = Promise.promisify(require("request"));
var fs = Promise.promisifyAll(require("fs"));
var path = require("path");
var spawn = require("child-process-promise").spawn;
var yaml = require("js-yaml");
var path = require("path");

var downloadPic = function(image){
    var imgDir = require("tinder-gather/app/config").gather.image_dir;
    var imgFilename = image._id + "." + image.ext;
    return fs.statAsync(path.join(imgDir,imgFilename))
        .catch(function(e){
            return image.download();
        })
};
var downloadPics = function(images){
    return Promise.all(images.map(function(image){
        var imgDir = require("tinder-gather/app/config").gather.image_dir;
        var imgFilename = image._id + "." + image.ext;
        return fs.statAsync(path.join(imgDir,imgFilename))
            .catch(function(e){
                return image.download();
            })
            .finally(function(){
                return imgFilename;
            });
    }));
};

var facefinder = function(list,configFile) {
    console.log("[detect-worker] - spawning new process");
    console.log(list)
    return spawn("./facefinder",[configFile])
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
        console.log(e);
        throw new Error(e);
    })
};


var detectFaces = function(id,configFile) {
    return DetectionJob.find({where:{_id:id}}).then(function(dj){
        return dj.getUnprocessedImages()
    }).then(function(list){
        var imgsPerGroup = 10; 
        var listGroups = _.toArray(_.groupBy(list,function(e,i){return Math.floor(i / imgsPerGroup);}));
        return Promise.reduce(listGroups,function(total,localList){
            return downloadPics(localList)
            .then(function(localListF){
                return facefinder(localListF,configFile);
            })
            .then(function(){
                return 1;
            });
        },0);
    });
};

var jobStatus = function(id,status){
    return DetectionJob.find({where:{_id:id}}).then(function(dj){
        dj.status = status;
        dj.save();
    });
};


var config = yaml.safeLoad(fs.readFileSync(argv.c));

require("tinder-gather/app/config").gather.image_dir = config.images;
if (argv.plain) {
    //require("tinder-gather/app/config").db.logging = false;
    DetectionJob.find({where:{_id:argv.id}}).then(function(dj){
        //return Image.findAll({where:{detection_job_id:argv.id}});
        return dj.getUnprocessedImages()
    }).each(function(image){
        return downloadPic(image);
    }).each(function(image){
        console.log(image._id + "." + image.ext);
    });
} else {
    //downloadPics(argv.id,config.images)
    jobStatus(argv.id,"started")
        .return(detectFaces(argv.id,argv.c))
        .then(jobStatus(argv.id,"finished"));
}
