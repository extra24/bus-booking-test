# Bus Booking Test

## 실행 방법 (로컬)

```bash
# 1. Docker 서비스 빌드 & 실행
docker-compose up --build --scale worker=5

# 2. 프론트엔드 실행
start frontend/index.html 브라우저에서 열기

# 3. 부하 테스트 실행
npm i -g artillery
artillery run artillery/artillery.yaml
```
