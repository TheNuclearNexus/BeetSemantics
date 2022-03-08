#############################################
#  _                 _                      #
# | |               | |                     #
# | |     __ _ _ __ | |_ ___ _ __ _ __      #
# | |    / _` | '_ \| __/ _ \ '__| '_ \     #
# | |___| (_| | | | | ||  __/ |  | | | |    #
# |______\__,_|_| |_|\__\___|_|  |_| |_|    #
#       | |                   | |           # 
#       | |     ___   __ _  __| |           # 
#       | |    / _ \ / _` |/ _` |           # 
#       | |___| (_) | (_| | (_| |           # 
#       |______\___/ \__,_|\__,_|           # 
#                                           #
#############################################

function_tag minecraft:load:
    values: ["#load:_private/load"]

function_tag load:_private/load:
    values:
        - "#load:_private/init"
        - id: "#load:pre_load"
          required: false
        - id: "#load:load"      
          required: false
        - id: "#load:post_load"
          required: false

function_tag load:_private/init:
    values: ["load:_private/init"]

function load:_private/init:
    # Reset scoreboards so packs can set values accurate for current load.
    scoreboard objectives add load.status dummy
    scoreboard players reset * load.status

###
# PlayerDB Load Resolving
##

merge function_tag load:load:
    values: ["#rx.playerdb:load"]

function_tag rx.playerdb:load:
    values:
        - id: "#rx.playerdb:load/dependencies"
          required: false

        - "#rx.playerdb:load/enumerate"
        - "#rx.playerdb:load/resolve"

function_tag ./load/enumerate:
    values: ["rx.playerdb:load/enumerate"]

function_tag ./load/resolve:
    values: ["rx.playerdb:load/resolve"]

version_parts = ["major", "minor", "patch"]

function ./load/enumerate:
    for suffix in version_parts:
        scoreboard players add f"#rx.playerdb.{suffix}" load.status 0

    function ./major

    scoreboard players reset #rx.playerdb.set load.status


for loop in loop_info(version_parts):
    suffix = version_parts[loop.index]
    path = generate_path(f"load/{suffix}")
    function path:
        fakeplayer = f"#rx.playerdb.{suffix}"
        ver_int = ctx.meta.version[loop.index - 1]

        # check if the current load.status is the same or less as us
        ## if so, check if we match
        ### if not, set version since we must be better
        ### if so, and we didn't set a version, than check the next part
        
        if score fakeplayer load.status matches f"..{ver_int}" expand:
            unless score fakeplayer load.status matches ver_int
                function ./set_version
        if not loop.last:
            if score fakeplayer load.status matches ver_int
                unless score #rx.playerdb.set load.status matches 1
                function f"./{loop.nextitem}"

version = {
    "major": 0,
    "minor": 1,
    "patch": 2
}

function ./set_version:
    verstr = f"{version.major}.{version.minor}.{version.patch}" 
    for suffix in version_parts:
        scoreboard players set f"#rx.playerdb.{suffix}" load.status version.major
    
    scoreboard players set #rx.playerdb.set load.status 1

    function ./resolve:
        schedule clear f"rx.playerdb:impl/v{verstr}/tick"
        if score #rx.playerdb.major load.status matches version.major
            if score #rx.playerdb.minor load.status matches version.minor
            if score #rx.playerdb.patch load.status matches version.patch
            function f"rx.playerdb:impl/v{verstr}/init"

# Since this logic is a bit tough, lets break it down here.
# We are using SemVer which defines 3 parts of our version: major, minor, patch
# 
# - major defines any breaking changes, mostly pertaining to rewrites
# - minor defines any new features that your pack may be relying on
# - patch defines any changes or fixes which apply to the feature set
# 
# Enumerate is called upon every instance of PlayerDB which is loaded in the world.
# It needs to first define the greatest version of PlayerDB by comparing the
#   major.minor.patch version and override the version if it thinks it's greater.
# 
# First we check the current major. For the first pack, it will be empty so we
#   will be the only version. Once we find a second instance of PlayerDB,
#   it will ask *"Am I greater than the previous major"*.
# 
# - If we are *greater*, then our version is the greatest version.
# - If we are *equal*, then our version needs to check minor.
# - If we are *lesser*, then our version is not the greatest version.
# 
# We then repeat these steps for minor and patch. For the final patch check,
#   there are 3 situations:
# 
# - We are now the greatest pack version
#     so we update the latest `load.status` version
# - We are the same pack version, in which our namespaces will collide
# - We are not the greatest pack version, in which we do **nothing**.
# 
# This process will ensure that the latest and greatest PlayerDB version is
#   the one which prevails! 
