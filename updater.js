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
var async  = require('async');

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
var safeVersions = [];

function findSaferVersion(model, version, callback) {
  nspAPI.validateModule(model, version, function (err, results) {
    if (err) {
      // An error generated from the underlying request.
      console.log(err);
    } else if (results.length !== 0) {
      //console.log("in func : %j", results);
      return callback(false);
    }
    else {
      return callback(true);
    }
  });
}
function checkVer(libs, versions) {
  var lib = libs.shift();
  var version = versions.shift();

  if(typeof libs === 'undefined' || typeof versions === 'undefined') {
    // it is not defined yet
    return;
  } else if (libs.length <= 0 || versions.length <= 0) {
    // you have a zero length array
    return;
  }
  request.get('http://registry.npmjs.org/' + lib, function (error, response, body) {
    async.series([
      function step1(callback_step1) {
        msg = "\nChecking verion of " + lib + ", current: ";
        console.log(msg.prompt + colors.yellow(version));
        callback_step1();
      },
      function step2(callback_step2) {
        if (!error && response.statusCode === 200) {
          var versions = [], ver;
          for (ver in JSON.parse(body).versions) {
            versions.push(ver);
          }
          async.series([
            function getSaferVer(callback_safer) {
              // make sure safeVersions is empty
              safeVersions.splice(0, safeVersions.length);
              async.eachSeries(versions,
                function (item, callback_each) {
                  findSaferVersion(lib, item, function (res) {
                    if (res) {
                      safeVersions.push(item);
                    }
                    callback_each();
                  });
                }, function done(err) {
                  if (err) {
                    throw err;
                  }
                  console.log("find safeVersions with lib = " + lib + "@" + safeVersions);
                  console.log("safeVersion done.");
                  callback_safer();
                }
              );
            },
            function insatllAndShowMsg(callback_install) {
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
              }
              callback_install();
            }
          ]);
        }
        callback_step2();
      }/*,
      function call_next(callback_next) {
        checkVer(libs, versions);
        callback_next();
      }*/
    ]);
    callback();
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
  var key;
  var module_dep = [];
  var c = 0;
  
  for (key in pkg.dependencies) {
    module_dep.push(key + "@" + pkg.dependencies[key]); 
    //if(c == 1) break;
    //c++;
  }
  for (dep in pkg.dependencies) {
    console.log(colors.info(' - ' + dep + ': ') + colors.bold(pkg.dependencies[dep]));
    deps.push(dep);
    depsVer.push(pkg.dependencies[dep]);
  }
  checkVer(deps, depsVer);
  /*async.eachSeries(module_dep,
    function (item, callback) {
      var lib = item.split("@")[0];
      var ver = item.split("@")[1];

      console.log(colors.info(' - ' + lib + ': ') + colors.bold(ver));
      deps.push(lib);
      depsVer.push(ver);
      callback(checkVer(lib, ver));
      
      //console.log(item[0]);
      //callback();
    },
    function done(err) {
      if (err) {
        throw err;
      }
      console.log("checkVer done.");
    }
  );*/
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
