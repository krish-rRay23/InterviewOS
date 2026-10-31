cmake_minimum_required(VERSION 3.20)
project(InterviewOS_Endpoint_Agent VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

add_executable(interviewos_agent src/main.cpp)
target_link_libraries(interviewos_agent PRIVATE
    bcrypt
    setupapi
    wtsapi32
    iphlpapi
    psapi
    rpcrt4
    ws2_32
    winhttp
)

add_executable(interviewos_agent_test tests/test_agent.cpp)
target_link_libraries(interviewos_agent_test PRIVATE
    bcrypt
    setupapi
    wtsapi32
    iphlpapi
    psapi
    rpcrt4
    ws2_32
    winhttp
)

