#!/usr/bin/env node

var nspAPI = require('nsp-api');
var fs = require('fs');
var npm = require("npm");
var request = require('request');
var colors = require('colors');
var cmpVer = require('compare-version');
var spawn = require('child_process').spawn;
var msg;
var semver = require('semver');

colors.setTheme({
  prompt: 'cyan',
  info: 'magenta',
  success: 'green',
  warn: 'yellow',
  error: 'red'
});

function updateLib(libName, currentVer, versions) {
  while (isNaN(currentVer[0])) {
    currentVer = currentVer.substr(1);
  }
  var currentIndexInVers = versions.lastIndexOf(currentVer);
  if (currentIndexInVers === -1) {
    console.log(colors.error("Can not recognize version: " + currentVer));
    return;
    //version not 100% match, should find the closest instead
    //currentIndexInVers = findRelatedVer(currentVer, versions);
  }
  var start = currentIndexInVers;
  var end = versions.length - 1;
  while (start !== end) {
    start = end; //temporarily fake statement, should be replaced by the binary version search algorithm
  }
  var newVer = versions[start];
  return newVer;
}


var pkgReadIn = fs.readFileSync("package.json", {encoding: 'utf8'});
var pkg = JSON.parse(pkgReadIn);

var depCount = Object.keys(pkg.dependencies).length;

msg = "Try to upgrade the dependencies of " + pkg.name + ' version ' + pkg.version + ' in safer method!\n';
console.log(msg.prompt);
msg = "Found " + depCount + (depCount ? ' dependencies :' : ' dependency');
console.log(msg.prompt);

var deps = [];
var depsVer = [];


function checkVer(lib, version) {
  version = pkg.dependencies[lib];
  request.get('http://registry.npmjs.org/' + lib, function (error, response, body) {
    msg = "\nChecking verion of " + lib + ", current: ";
    console.log(msg.prompt + colors.yellow(version));
    if (!error && response.statusCode === 200) {
      var versions = [],
        temp = JSON.parse(body).versions,
        ver;
      for (ver in temp) {
        versions.push(ver);
      }
      console.log("versions: ".prompt + colors.bold(versions));
      console.log("The latest version: ".prompt + colors.bold(versions[versions.length - 1]));
      var needUpdate = (cmpVer(versions[versions.length - 1], version) > 0 ? true : false);
      console.log(colors.info((needUpdate ? colors.bold("Need") : "No need") + " to update!"));
      if (needUpdate) {
        var newVer = updateLib(lib, version, versions);
        pkg.dependencies[lib] = newVer;
        /* bad implement ... for prototype only npm install start */
        var npmInstall = spawn('npm', ['install', lib + '@' + newVer, '--save']);
        npmInstall.on('close', function (code) {
          if (!code) {
            var npmUpdate = spawn('npm', ['update', lib]);
            npmUpdate.on('close', function (code2) {
              if (!code2) {
                msg = "Dependency - " + lib + " upgaded to v" + newVer + " successfully!";
              } else {
                msg = "Dependency - " + lib + " v" + newVer + " has been installed, but update process failed! " + code2;
              }
              console.log(colors.prompt(msg));
            });
          } else {
            console.log(colors.error("Dependency - " + lib + " upgrade failed! exit code: " + code));
            console.log(colors.error("This may not make sense 'cause this is just the final step, please open an issue on GitHub"));
          }
        });
        /* the dirty part above should be replced by the confirmed and fixed version below */
      /*npm.load(function() {
          //not sure if npm api support this usage like npm command, need to be confirmed
          npm.commands.install(lib + "@" + newVer, function(res){
            console.log(res);
          );
          npm.commands.update([lib], function(res){
            console.log(res);
          })
        })*/
      }
    }
  });
}
function findRelatedVer(currentVer, versions) {
//  cmpVer(currentVer,)
}
function findCompatibleVer(currentVer, versions) {
  console.log("Competible Version: ".prompt + semver.maxSatisfying(versions, currentVer));
  return semver.maxSatisfying(versions, currentVer);
}
//Should also handle devDependencies in future
if (depCount) {
  var dep;
  for (dep in pkg.dependencies) {
    console.log(colors.info(' - ' + dep + ': ') + colors.bold(pkg.dependencies[dep]));
    deps.push(dep);
    depsVer.push(pkg.dependencies[dep]);
    checkVer(dep, pkg.dependencies[dep]);
  }
}

function testLibVersion(lib, version) {
  npm.load("", function (er) {
    var module = null;

    if (er) {
      /* loading error */
      console.log(er);
    }
    npm.commands.install([module, ""], function (er, data) {
      /*
      *  install module succeeded, then go testing.
      *  otherwise, alert error and do nothing.
      */
      if (er) {
        console.log(er);
      } else {
        npm.commands.test("package.json", function (er) {
          /*
          *  if passed the test, write back to package.json.
          *  otherwise, reinstall by package.json.
          */
          if (er) {
            console.log(er);
            /*  (I'm not really sure about the situation,
            *   that when i testing another module, it will be possible unpassed
            *   test because of last problematic moduel.
            */
            npm.commands.install(["", ""]);
          } else {
            console.log("OK!");
            pkg.dependencies[lib] = version;
            fs.writeFileSync("package.json", JSON.stringify(pkg), 'utf8');
          }
        });
        console.log(data);
      }
    });
  });
}

function saferVersion(model, version, callback) {
  nspAPI.validateModule(model, version, function (err, results) {
    if (err) {
      // An error generated from the underlying request.
      console.log(err);
    } else if (results.length !== 0) {
      console.log("in func : %j", results);
      return callback(false);
    } else {
      return callback(true);
    }
  });
}
