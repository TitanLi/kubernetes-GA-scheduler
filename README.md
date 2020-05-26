# kubernetes-scheduler-algorithm
> Ubuntu 18.04
## DNS
方法一：
```shell
$ vim /etc/netplan/*.yaml
network:
    version: 2
    ethernets:
        eth0:
            addresses:
            - 123.123.123.123/20
            - 10.0.0.0/16
            gateway4: 123.123.123.1
            match:
                macaddress: cc:8c:11:e1:1b:81
            nameservers:
                addresses:
                - 8.8.8.8
                - 8.8.4.4
                search: []
            set-name: eth0

$ sudo netplan apply
# 替换掉 systemd-resolved 生成的 resolv.conf 文件
$ sudo rm /etc/resolv.conf
$ sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

## Wake on LAN
> Ubuntu 18.04
1. Install ethtool with
```shell
$ sudo apt-get install ethtool
```
2. Run the command
```shell
$ sudo ethtool -s eno1 wol g
```
3. On Ubuntu 18.04, you need to create a systemd service as opposed to enabling, creating and/or modifying rc.local as you would’ve done on previous versions. So, navigate to
```shell
$ cd /etc/systemd/system
$ sudo vim wol.service
[Unit]
Description=Configure Wake-up on LAN

[Service]
Type=oneshot
ExecStart=/sbin/ethtool -s eno1 wol g

[Install]
WantedBy=basic.target
```
4. Once you’ve created your file, you need to add it to the systemd services so you should run
```shell
$ sudo systemctl daemon-reload
$ sudo systemctl enable wol.service
$ sudo systemctl start wol.service
```
## remove cloud-init
> Ubuntu 18.04
```shell
$ echo 'datasource_list: [ None ]' | sudo -s tee /etc/cloud/cloud.cfg.d/90_dpkg.cfg
$ sudo apt-get purge cloud-init
$ sudo rm -rf /etc/cloud/; sudo rm -rf /var/lib/cloud/
$ reboot
```